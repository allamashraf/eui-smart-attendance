// Browser-side C++ analytics for the SYNTHETIC EUI attendance prototype.
// Does not authorize check-ins, decide penalties, or define EUI policy.
// Rebuild: npm run build:cpp
extern "C" {
int attendance_percent(int attended, int completed_sessions) {
  if (completed_sessions < 0 || attended < 0 || attended > completed_sessions) return -1;
  if (completed_sessions == 0) return 0;
  return static_cast<int>((static_cast<long long>(attended) * 100 + completed_sessions / 2) / completed_sessions);
}
int attendance_band(int attended, int completed_sessions, int target_percent) {
  if (completed_sessions < 0 || attended < 0 || attended > completed_sessions || target_percent < 0 || target_percent > 100) return -1;
  if (completed_sessions == 0) return 0;
  return static_cast<long long>(attended) * 100 < static_cast<long long>(completed_sessions) * target_percent ? 1 : 2;
}
}
