-- Read-only examples. Run in a SQL editor after seeding.
SELECT u.username, u.full_name, u.role FROM users u ORDER BY u.role,u.username;
SELECT s.code,s.title,s.term,u.full_name AS instructor,COUNT(e.id) AS enrolled
 FROM subjects s JOIN users u ON u.id=s.instructor_id
 LEFT JOIN enrollments e ON e.subject_id=s.id AND e.status='active'
 GROUP BY s.id,u.full_name ORDER BY s.code;
SELECT s.title,s.state,s.started_at,COUNT(a.id) AS checkins
 FROM class_sessions s LEFT JOIN attendance_records a ON a.session_id=s.id
 GROUP BY s.id ORDER BY s.started_at DESC;
SELECT a.rule_key,a.score,a.state,a.demo,s.title AS session_name
 FROM risk_alerts a JOIN class_sessions s ON s.id=a.session_id;
