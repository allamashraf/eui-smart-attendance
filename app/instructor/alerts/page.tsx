import {ShieldAlert} from 'lucide-react';
import {requireUser} from '@/lib/auth';
import {query} from '@/lib/db';
import {Shell,SectionHeader,displayDate} from '@/components/Shell';
import {InstructorAlertReviews} from './InstructorAlertReviews';
export const dynamic='force-dynamic';
export default async function InstructorAlertsPage(){
  const user=await requireUser('instructor');
  const {rows}=await query(`SELECT a.id,a.score,a.rule_key AS rule,a.explanation AS description,
    a.state,a.demo,a.created_at,s.title AS session,sub.code,u.full_name AS student,
    r.outcome,r.notes AS "reviewNotes"
    FROM risk_alerts a JOIN class_sessions s ON s.id=a.session_id
    JOIN subjects sub ON sub.id=s.subject_id
    LEFT JOIN users u ON u.id=a.student_id
    LEFT JOIN LATERAL (SELECT outcome,notes FROM risk_reviews
      WHERE alert_id=a.id ORDER BY created_at DESC LIMIT 1) r ON true
    WHERE sub.instructor_id=$1
    ORDER BY (a.state='open') DESC,a.score DESC,a.created_at DESC LIMIT 100`,[user.id]);
  const alerts=rows.map(a=>({...a,created:displayDate(a.created_at)}));
  return <Shell user={user} active="/instructor/alerts" heading="Security alerts"
    subtitle="Only alerts from your own classes appear here. An alert is not proof of misconduct.">
    <section className="card card-pad section">
      <SectionHeader title="Review queue" note="Verify the classroom context before resolving any alert."/>
      <InstructorAlertReviews alerts={alerts}/>
    </section>
  </Shell>;
}
