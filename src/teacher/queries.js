/**
 * TEACHER QUERIES — §107, on the §109 isolated teacher client. Read-only data access for the
 * teacher dashboard. All reads are scoped by the teacher-read RLS from migration 0005 — this
 * module trusts the DB to filter; it never reads the students table or blobs.
 *
 * Every function is fully try/catch'd and resolves to a discriminated result
 * ({ ok:true, data } | { ok:false, error }) — never throws, never leaves the UI on a
 * spinner (never-stuck #7). Logging is counts/status-only (§87/§88) — never student text.
 */
import { getTeacherClient } from "./teacher-client.js";

function logT(msg, extra) {
  try { console.info(`[lyra-teacher] ${msg}`, extra || ""); } catch (e) { /* silent */ }
}

/** Classes the signed-in teacher owns, each with an enrolment count. */
export async function myClasses() {
  try {
    const sb = getTeacherClient();
    if (!sb) return { ok: false, error: "not-configured" };
    const { data: classes, error } = await sb.from("classes").select("id, name").order("name");
    if (error) { logT("classes query failed", { code: error.code }); return { ok: false, error: "query-failed" }; }
    const ids = (classes || []).map((c) => c.id);
    const counts = {};
    if (ids.length) {
      const { data: enr, error: e2 } = await sb.from("enrolments").select("class_id").in("class_id", ids);
      if (e2) { logT("enrolment count failed", { code: e2.code }); return { ok: false, error: "query-failed" }; }
      for (const r of enr || []) counts[r.class_id] = (counts[r.class_id] || 0) + 1;
    }
    return { ok: true, data: (classes || []).map((c) => ({ id: c.id, name: c.name, studentCount: counts[c.id] || 0 })) };
  } catch (e) {
    logT("myClasses threw", { code: e?.name });
    return { ok: false, error: "threw" };
  }
}

/** Roster for a class: each enrolled student's display_name + per-type event counts. */
export async function roster(classId) {
  try {
    const sb = getTeacherClient();
    if (!sb) return { ok: false, error: "not-configured" };
    const { data: enr, error } = await sb.from("enrolments").select("student_id, display_name").eq("class_id", classId);
    if (error) { logT("roster query failed", { code: error.code }); return { ok: false, error: "query-failed" }; }
    const ids = (enr || []).map((e) => e.student_id);
    let events = [];
    if (ids.length) {
      // NOTE (review Group B): counts are tallied client-side from raw rows, so PostgREST's
      // default db.max_rows (1000) would silently undercount a class with >1000 lifetime
      // events. Inert at seed/pilot scale (~dozens); when it matters, switch to a grouped
      // count view or `count: 'exact', head: true` rather than transferring per-row data.
      const { data: ev, error: e2 } = await sb.from("learning_events").select("student_id, type").in("student_id", ids);
      if (e2) { logT("roster events failed", { code: e2.code }); return { ok: false, error: "query-failed" }; }
      events = ev || [];
    }
    const byStudent = {};
    for (const e of events) {
      if (!byStudent[e.student_id]) byStudent[e.student_id] = {};
      byStudent[e.student_id][e.type] = (byStudent[e.student_id][e.type] || 0) + 1;
    }
    const rows = (enr || []).map((e) => {
      const counts = byStudent[e.student_id] || {};
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      return { studentId: e.student_id, displayName: e.display_name, counts, total };
    });
    return { ok: true, data: rows };
  } catch (e) {
    logT("roster threw", { code: e?.name });
    return { ok: false, error: "threw" };
  }
}

/**
 * Per-student detail: rule frequency (via the student_rule_frequency view, teacher-RLS
 * scoped), the growth profile jsonb, and activity counts by event type. Returns
 * profile:null when the student has no growth profile yet (an honest empty, not an error).
 */
export async function studentDetail(studentId) {
  try {
    const sb = getTeacherClient();
    if (!sb) return { ok: false, error: "not-configured" };
    const [freqRes, profRes, evRes] = await Promise.all([
      sb.from("student_rule_frequency").select("rule, occurrences, first_seen, last_seen")
        .eq("student_id", studentId).order("occurrences", { ascending: false }),
      sb.from("growth_profiles").select("profile, last_regen_at").eq("student_id", studentId).limit(1),
      // NOTE (review Group B): same db.max_rows (1000) caveat as roster() — activity tallies
      // are client-side; fine at seed/pilot scale, revisit with a count view if a single
      // student ever exceeds 1000 lifetime events.
      sb.from("learning_events").select("type, ts").eq("student_id", studentId),
    ]);
    if (freqRes.error || profRes.error || evRes.error) {
      logT("studentDetail query failed", { code: (freqRes.error || profRes.error || evRes.error)?.code });
      return { ok: false, error: "query-failed" };
    }
    const profRow = profRes.data && profRes.data[0];
    const activityByType = {};
    for (const e of evRes.data || []) activityByType[e.type] = (activityByType[e.type] || 0) + 1;
    return {
      ok: true,
      data: {
        ruleFrequency: freqRes.data || [],
        profile: profRow ? profRow.profile : null,
        lastRegenAt: profRow ? profRow.last_regen_at : null,
        activityByType,
      },
    };
  } catch (e) {
    logT("studentDetail threw", { code: e?.name });
    return { ok: false, error: "threw" };
  }
}
