// TEACHER ENTRY — §106. A SEPARATE Vite entry (teacher.html → here), same origin as the
// student app, behind the same Basic-Auth gate + security headers. It shares ONLY the
// Supabase client module with the student app (D-A4); nothing here imports student UI.
import React from "react";
import ReactDOM from "react-dom/client";
import TeacherApp from "./TeacherApp.jsx";

// Minimal, teacher-local error boundary (no student-app import). A render crash resolves
// to an honest message, never a blank white screen (never-stuck #7).
class TeacherErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { crashed: false }; }
  static getDerivedStateFromError() { return { crashed: true }; }
  componentDidCatch(err) { try { console.error("[lyra-teacher] render crash", err?.name); } catch (e) { /* silent */ } }
  render() {
    if (this.state.crashed) {
      return (
        <div style={{ maxWidth: 520, margin: "80px auto", fontFamily: "system-ui, sans-serif", color: "#171b24", padding: 24 }}>
          <h1 style={{ fontSize: 20 }}>Something went wrong</h1>
          <p style={{ color: "#454b58" }}>Please reload the page. If it keeps happening, tell the Lyra operator.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <TeacherErrorBoundary>
    <TeacherApp />
  </TeacherErrorBoundary>
);
