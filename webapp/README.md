# SafeTrak Web — Firebase administrator dashboard

This is the working SafeTrak administrator web app. It keeps the supplied light UI direction (white/off-white surfaces, black typography, rounded controls, Playfair-style display headings) while wiring the important actions to Firebase.

## What is working

- Admin registration with institution-code validation
- Firebase email/password admin login
- Returning-admin login without signing up again
- Password reset from the admin login page
- Administrator-only dashboard access
- 8-character SafeTrak dashboard code generated for each admin
- Dashboard-code login for administrators
- Dashboard-code rotation without logging the current session out
- Old dashboard codes are invalidated through `admin_access`
- Student roster loaded from Firestore by the authenticated admin's institution code
- Add student
- Edit student
- Remove student
- Search students
- Status filtering
- CSV export
- Student statistics
- Institution name shown from Firestore
- Firestore-backed dashboard code modal
- Separate Firebase Auth/Firestore instances for normal admin sessions, code sessions and hidden code-account provisioning

## Important Firebase data relationship

The supplied database uses this structure:

```text
admins/{firebaseAuthUid}
  institution_id: "CH1234"
  institution_code: "CH1234"
  role: "Admin"

institutions/CH1234
  code: "CH1234"
  name: "Christ University"

students/CHR-074
  institution_id: "CH1234"

students/CHR-101
  institution_id: "CH1234"
```

The dashboard now queries students with the exact institution code:

```text
where("institution_id", "==", admin.institution_code)
```

This is deliberate. A broad Firestore query such as an `in` query containing multiple possible institution IDs can be rejected by Firestore Security Rules even when every returned document would eventually be allowed. Firestore rules do not filter query results; the query itself must satisfy the rule.

## VERY IMPORTANT — deploy the Firestore rules

The browser code cannot change Firebase Security Rules. The included `firestore.rules` must be deployed to the same Firebase project shown in the supplied `.env.local` (`safetrack-47`).

From the project folder:

```bash
npm install
firebase login
firebase use safetrack-47
firebase deploy --only firestore:rules
```

Or copy `firestore.rules` into:

```text
Firebase Console → Firestore Database → Rules
```

and publish it.

If the dashboard displays:

```text
Firebase connection: Firestore denied this request...
```

the first thing to check is whether the included rules have actually been published.

## Authentication model

### Admin email/password

An administrator signs up once using:

- Name
- Email
- Password
- Institution code

The institution code is checked against the `institutions` collection. A Firebase Authentication account and matching `admins/{uid}` document are then created.

The same administrator can later use **Admin Log In** with the same email/password. They do not need to sign up again.

### Dashboard code

The dashboard code is not a student login.

It is an administrator-only alternate credential for opening the protected dashboard. The app creates a separate hidden Firebase Authentication account for the generated code and stores its mapping in:

```text
admin_access/{accessFirebaseUid}
  admin_uid: "the-real-admin-uid"
```

The Firestore rules resolve the code account back to the real admin before allowing dashboard data access.

A third Firebase Auth instance is used only to provision/rotate these hidden code accounts. This is important because creating a new code must not sign the current administrator out.

## Student add flow

Click **Add student** and enter:

- SafeTrak card ID, e.g. `CHR-101`
- Student name
- Class / section
- Guardian phone
- Status

The institution is automatically taken from the logged-in administrator. It is not manually entered by the user.

A new document is written as:

```text
students/{cardId}
  name
  class_section
  guardian_phone
  guardian_phone_clean
  institution_id
  status
  battery
  last_seen
  created_at
  updated_at
```

## Why CHR-074 and CHR-101 should appear

With the database shown in the supplied screenshots:

```text
admin institution_code = CH1234
institution CH1234      = CH1234
CHR-074 institution_id  = CH1234
CHR-101 institution_id  = CH1234
```

both student documents satisfy the dashboard's institution query and the included rules.

If they still do not appear after using this version, open the browser console. A `permission-denied` error means the deployed Firestore rules do not match the included rules yet.

## Development

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
```

## Firebase configuration

The project reads Firebase configuration from `.env.local` using Vite variables. `.env.example` is included as a template.

Firebase Authentication must have **Email/Password** enabled.

Do not add a Firebase Admin SDK service-account JSON file to this frontend project.


## Firebase deployment

The website uses two administrator login modes:
- email/password: the real Firebase Auth administrator account
- dashboard code: a separate Firebase Auth credential mapped to the real administrator UID in `admin_access`

Always deploy the Firestore rules after changing them:

```bash
firebase login
firebase use safetrack-47
firebase deploy --only firestore:rules
```

The app deliberately clears both Firebase sessions when switching login modes so an older administrator cannot silently be reused.

The `students` rules allow an administrator to check a new card document that does not yet exist. This is required by the Add Student duplicate-card check while keeping existing students restricted to the administrator's institution.


## Guardian mobile web app

The same Vite/React project now includes the guardian-facing mobile web app:

- `/guardian` — guardian login using the existing `students/{cardId}` record and matching guardian phone.
- `/guardian/home` — live student status, battery, live location and last update.
- `/guardian/history` — historical events from the existing `students/{cardId}/logs` subcollection, with a fallback to the older `alerts` collection if no logs exist.

### Existing database contract preserved

No Firestore collections, document IDs, or existing student fields were renamed or migrated. The guardian app reads the existing `students`, `locations`, and `alerts` collections.

The Firestore rules were updated only to expose the read paths required by the documented guardian prototype:
- exact `students/{cardId}` document reads are allowed for guardian verification;
- `locations/{cardId}` can be read without an authenticated admin session;
- `students/{cardId}/logs/{logId}` are read-only for the history view; the app reads the existing `timestamp`, `status`, `emergency_status`, `lat`, and `lon` fields without changing them.
- `alerts` remain read-only as a backward-compatible fallback.

This follows the project's documented client-side guardian access model. For production hardening, use Firebase Phone Authentication/OTP as described in the project report.

### Run

```bash
npm install
npm run dev
```

Then open `/guardian` on a phone or use the browser's mobile device preview.

### Firebase rules

Deploy the included rules to the existing Firebase project before testing guardian location/history:

```bash
firebase deploy --only firestore:rules
```

The guardian map uses the free OpenStreetMap embed and does not require a Google Maps API key.

### Guardian history data flow

The History page reads: `students/{cardId}/logs/{logId}`. Each log is shown by timestamp and can be expanded to view its status, emergency status, recorded coordinates, and the corresponding map location. The app does not create, rename, migrate, or modify any Firestore data.
