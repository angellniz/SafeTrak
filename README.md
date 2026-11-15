
# SafeTrak – Student Identity & Safety System

SafeTrak is an IoT-based student identity and safety monitoring system designed to support student safety through motion monitoring, fault detection, GPS tracking and cloud-based guardian monitoring.

## Project Overview

SafeTrak consists of three main layers:

1. Hardware Layer – ESP32 microcontroller, MPU6050 motion sensor and GPS module.
2. Cloud Layer – Blynk IoT, Python integration bridge and Firebase Firestore.
3. Application Layer – Administrator dashboard and guardian mobile web application.

## System Architecture

ESP32 Smart ID Card
        |
        v
Blynk IoT Cloud
        |
        v
Python–Firebase Bridge
        |
        v
Firebase Firestore
       / \
      /   \
     v     v
Admin   Guardian
Dashboard Interface

## Features

### Hardware
- ESP32-based smart identity card
- Motion monitoring using MPU6050
- Threshold-based fault detection
- GPS location acquisition
- Blynk IoT communication

### Cloud Integration
- Blynk IoT integration
- Python-based data synchronization
- Firebase Firestore database
- Historical event logging

### Administrator Dashboard
- Administrator registration and login
- Institution-based student management
- Student card registration and removal
- Student status monitoring
- Historical event management

### Guardian Interface
- Guardian login
- Live student status monitoring
- Battery information
- GPS location display
- Historical event timeline

## Technologies Used

- ESP32
- Arduino IDE / C++
- MPU6050
- GPS module
- Blynk IoT
- Python
- Firebase Authentication
- Cloud Firestore
- React
- Vite
- JavaScript
- Tailwind CSS

## Repository Structure

- `hardware/` – Circuit diagram and hardware documentation
- `firmware/` – ESP32 source code
- `bridge/` – Python–Firebase integration
- `web-app/` – Administrator and guardian web application
- `docs/` – Project report, diagrams and screenshots
- `demo/` – Demonstration video information

## Running the Web Application

1. Install Node.js.
2. Open the `web-app` directory.
3. Install dependencies:

   `npm install`

4. Configure Firebase environment variables in `.env.local`.
5. Start the development server:

   `npm run dev`

## Running the Python Bridge

1. Install Python.
2. Open the `bridge` directory.
3. Install dependencies:

   `pip install -r requirements.txt`

4. Configure the required environment variables and Firebase credentials locally.
5. Run:

   `python blynkapp_firebase_bridge.py`

## Database Structure

The application uses Firestore collections and documents, including:

- `students/{cardId}`
- `locations/{cardId}`
- `students/{cardId}/logs/{logId}`

## Limitations

SafeTrak is an academic prototype. Guardian authentication and database access controls require further security improvements before real-world deployment.

## Future Enhancements

- Verified guardian authentication using OTP
- Improved device authentication
- Enhanced monitoring and analytics
- Further hardware testing and reliability improvements

## Disclaimer

This project is developed for academic and demonstration purposes.
Do not use real student information or production credentials in this repository.
