import logo from "../assets/logo.png";

export default function Logo({ className = "" }) {
  return <img src={logo} alt="SafeTrak" className={className} />;
}
