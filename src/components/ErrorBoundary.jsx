import { Component } from "react";
import { COLORS } from "../constants.js";
import { FeatherIcon } from "./Icons.jsx";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Lyra Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          fontFamily: "'Courier Prime', monospace",
          background: COLORS.bg1,
          color: COLORS.text,
          maxWidth: 430,
          margin: "0 auto",
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
          textAlign: "center",
        }}>
          <FeatherIcon size={48} color={COLORS.accent2} />
          <h2 style={{ fontFamily: "'Special Elite', cursive", fontSize: 22, color: COLORS.heading, marginTop: 24, marginBottom: 8 }}>
            Something went wrong
          </h2>
          <p style={{ fontSize: 14, color: COLORS.muted, lineHeight: 1.6, marginBottom: 24 }}>
            Lyra encountered an unexpected error. Your work is safely saved in your browser.
          </p>
          <p style={{ fontSize: 12, color: COLORS.accent2, marginBottom: 24, maxWidth: 320, wordBreak: "break-word" }}>
            {this.state.error?.message || "Unknown error"}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            style={{
              background: `linear-gradient(135deg, ${COLORS.accent1}, ${COLORS.accent2})`,
              color: "#fff",
              border: "none",
              borderRadius: 24,
              padding: "12px 32px",
              fontFamily: "'Courier Prime', monospace",
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Reload Lyra
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
