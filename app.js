// state
const state = {
  applications: [],   // {id, name, studentId, email, pStatus, fStatus, rejectedFromAssignment}
  students: {},       // studentId -> {password, reports:[...], evalSubmitted}
  supervisors: [],    // {name, company, email, password}
  deadline: null,
  reminderLog: [],
  currentUser: null,  // {role:'student'|'coord'|'supervisor', id}
  currentSupervisor: null
};

// Seed coordinator
const COORD = { username: 'coord', password: 'coord123' };

// nav
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  if (id === 'coordinator') { renderApplications(); renderReports(); renderReminders(); renderSupervisorsList(); loadDeadline(); }
  if (id === 'student-portal') { renderMyStatus(); updateDeadlineDisplay(); }
}

function switchLoginTab(tab, btn) {
  document.querySelectorAll('#page-login .section').forEach(s => s.classList.remove('active'));
  document.getElementById('login-' + tab).classList.add('active');
  document.querySelectorAll('#page-login .tabs button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function switchTab(group, tab, btn) {
  // prevent access to eval tab without sup login
  if (group === 'sup' && tab === 'eval' && !state.currentSupervisor) {
    return msg('sup-msg', 'err', 'Please log in first to submit evaluations.');
  }
  const prefix = group === 'coord' ? 'coord'
               : group === 'sup' ? 'sup'
               : group === 'eval-method' ? 'eval-method'
               : 'student';
  document.querySelectorAll(`[id^="${prefix}-"]`).forEach(s => {
    if (s.classList.contains('section')) s.classList.remove('active');
  });
  document.getElementById(prefix + '-' + tab).classList.add('active');
  if (btn) {
    btn.closest('.tabs').querySelectorAll('button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }
}

// app submission
function submitApplication() {
  const name = v('apply-name'), sid = v('apply-id'), email = v('apply-email');
  if (!name || !sid || !email) return msg('apply-msg', 'err', 'All fields are required.');
  if (!email.includes('@')) return msg('apply-msg', 'err', 'Invalid email address.');
  if (state.applications.find(a => a.studentId === sid))
    return msg('apply-msg', 'err', 'An application with this Student ID already exists.');
  const app = { id: Date.now(), name, studentId: sid, email, pStatus: 'pending', fStatus: 'pending', rejectedFromAssignment: false };
  state.applications.push(app);
  state.students[sid] = { password: sid, reports: [], evalSubmitted: false };
  msg('apply-msg', 'ok', 'Application submitted successfully! Your Student ID is your temporary password.');
  clear('apply-name', 'apply-id', 'apply-email');
}

// login
function loginStudent() {
  const sid = v('login-sid'), pw = v('login-spw');
  const app = state.applications.find(a => a.studentId === sid);
  if (!app) return msg('login-msg', 'err', 'Student ID not found.');
  if (app.pStatus !== 'accepted' && app.fStatus !== 'accepted')
    return msg('login-msg', 'err', 'You have not been provisionally accepted yet.');
  const stu = state.students[sid];
  if (!stu || stu.password !== pw) return msg('login-msg', 'err', 'Incorrect password.');
  state.currentUser = { role: 'student', id: sid };
  setNavUser('Student: ' + app.name);
  showPage('student-portal');
  renderMyStatus();
}

function loginCoord() {
  const u = v('login-cu'), p = v('login-cpw');
  if (u !== COORD.username || p !== COORD.password)
    return msg('login-msg', 'err', 'Invalid coordinator credentials.');
  state.currentUser = { role: 'coord' };
  setNavUser('Coordinator');
  document.getElementById('nav-coord').style.display = '';
  showPage('coordinator');
}

function loginSupervisor() {
  const email = v('sup-lemail'), pw = v('sup-lpw');
  const sup = state.supervisors.find(s => s.email === email && s.password === pw);
  if (!sup) return msg('sup-msg', 'err', 'Invalid email or password.');
  state.currentSupervisor = sup;
  setNavUser('Supervisor: ' + sup.name);
  document.querySelectorAll('[id^="sup-"]').forEach(s => {
    if (s.classList.contains('section')) s.classList.remove('active');
  });
  document.getElementById('sup-eval').classList.add('active');
  msg('sup-msg', 'ok', 'Logged in! Submit your evaluation below.');
}


function logout() {
  state.currentUser = null;
  state.currentSupervisor = null;
  document.getElementById('nav-coord').style.display = 'none';
  document.getElementById('nav-student').style.display = 'none';
  document.querySelectorAll('[id^="sup-"]').forEach(s => {
    if (s.classList.contains('section')) s.classList.remove('active');
  });
  document.getElementById('sup-login').classList.add('active');
  setNavUser('');
  showPage('home');
}

function setNavUser(txt) {
  const statusEl = document.getElementById('nav-status');
  if (txt) {
    statusEl.textContent = 'signed in as ' + txt;
    statusEl.classList.add('logged-in');
  } else {
    statusEl.textContent = 'not signed in';
    statusEl.classList.remove('logged-in');
  }
  document.getElementById('nav-logout').style.display = txt ? '' : 'none';
}

// supervisor
function registerSupervisor() {
  const name = v('sup-name'), company = v('sup-company'), email = v('sup-email'), pw = v('sup-pw');
  if (!name || !company || !email || !pw) return msg('sup-msg', 'err', 'All fields required.');
  if (state.supervisors.find(s => s.email === email))
    return msg('sup-msg', 'err', 'Email already registered.');
  state.supervisors.push({ name, company, email, password: pw });
  msg('sup-msg', 'ok', 'Account created! You can now log in.');
  clear('sup-name', 'sup-company', 'sup-email', 'sup-pw');
}

// supervisor creation (coordinator)
function createSupervisor() {
  if (!state.currentUser || state.currentUser.role !== 'coord')
    return msg('coord-sup-msg', 'err', 'Only coordinators can create supervisor accounts.');
  const name = v('coord-sup-name'), company = v('coord-sup-company'), email = v('coord-sup-email');
  let pw = v('coord-sup-pw');
  if (!name || !company || !email) return msg('coord-sup-msg', 'err', 'Name, company, and email are required.');
  if (!pw) pw = email.split('@')[0] + Math.floor(Math.random() * 1000);
  if (state.supervisors.find(s => s.email === email))
    return msg('coord-sup-msg', 'err', 'Email already in use.');
  state.supervisors.push({ name, company, email, password: pw });
  msg('coord-sup-msg', 'ok', 'supervisor created! email: ' + email + ', pw: ' + pw);
  clear('coord-sup-name', 'coord-sup-company', 'coord-sup-email', 'coord-sup-pw');
  renderSupervisorsList();
}

function renderSupervisorsList() {
  const list = document.getElementById('supervisors-list');
  if (state.supervisors.length === 0) {
    list.innerHTML = '<em style="color:#999">no supervisors yet</em>';
  } else {
    list.innerHTML = state.supervisors.map(s => `
      <div style="padding:8px; border:1px solid #ddd; margin-bottom:8px; border-radius:3px">
        <strong>${s.name}</strong> (${s.company})<br>
        <small>email: ${s.email} | pw: ${s.password}</small>
      </div>
    `).join('');
  }
}

function submitEvaluation() {
  if (!state.currentSupervisor) return msg('eval-msg', 'err', 'Please log in first.');
  const sid = v('eval-sid'), term = v('eval-term');
  if (!sid || !term) return msg('eval-msg', 'err', 'Student ID and work term are required.');
  if (!state.students[sid]) return msg('eval-msg', 'err', 'Student not found.');
  state.students[sid].evalSubmitted = true;
  msg('eval-msg', 'ok', 'Evaluation submitted successfully.');
}

// student portal
function submitReport() {
  if (!state.currentUser || state.currentUser.role !== 'student')
    return msg('report-msg', 'err', 'Not logged in.');
  const sid = state.currentUser.id;
  const term = v('report-term');
  const file = document.getElementById('report-file').files[0];
  if (!term) return msg('report-msg', 'err', 'Please enter the work term.');
  if (!file) return msg('report-msg', 'err', 'Please select a PDF file.');
  if (!file.name.toLowerCase().endsWith('.pdf'))
    return msg('report-msg', 'err', 'Only PDF files are accepted.');
  if (state.deadline) {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const dl = new Date(state.deadline + 'T00:00:00');
    if (now > dl)
      return msg('report-msg', 'warn', 'The deadline has passed. Submission rejected. Contact coordinator for override.');
  }
  state.students[sid].reports.push({ term, filename: file.name, submitted: new Date().toLocaleDateString() });
  msg('report-msg', 'ok', 'Report submitted successfully.');
  renderMyStatus();
}

function renderMyStatus() {
  if (!state.currentUser || state.currentUser.role !== 'student') return;
  const sid = state.currentUser.id;
  const app = state.applications.find(a => a.studentId === sid);
  const stu = state.students[sid];
  if (!app) return;
  const el = document.getElementById('my-status-content');
  const reports = stu.reports.map(r =>
    `<tr><td>${r.term}</td><td>${r.filename}</td><td>${r.submitted}</td></tr>`
  ).join('') || '<tr><td colspan=3>No reports submitted.</td></tr>';
  el.innerHTML = `
    <p><strong>Name:</strong> ${app.name} &nbsp; <strong>ID:</strong> ${app.studentId}</p>
    <p style="margin-top:6px"><strong>Provisional Status:</strong> <span class="badge ${app.pStatus}">${app.pStatus}</span></p>
    <p style="margin-top:4px"><strong>Final Status:</strong> <span class="badge ${app.fStatus === 'pending' ? 'pending' : app.fStatus}">${app.fStatus}</span></p>
    ${app.rejectedFromAssignment ? '<p style="margin-top:4px"><strong>Note:</strong> You have been rejected from your co-op assignment.</p>' : ''}
    <p style="margin-top:4px"><strong>Evaluation Submitted:</strong> ${stu.evalSubmitted ? 'Yes' : 'No'}</p>
    <h3 style="margin-top:16px">Submitted Reports</h3>
    <table><thead><tr><th>Work Term</th><th>File</th><th>Date</th></tr></thead><tbody>${reports}</tbody></table>`;
}

function updateDeadlineDisplay() {
  document.getElementById('report-deadline-display').textContent = state.deadline || 'No deadline set';
}

function downloadTemplate() {
  alert('Template download: In a real system, a PDF template would be provided here.');
}

// coord
function renderApplications() {
  const q = (v('coord-search') || '').toLowerCase();
  const filtered = state.applications.filter(a =>
    a.name.toLowerCase().includes(q) || a.studentId.includes(q));
  const rows = filtered.map(a => `
    <tr>
      <td>${a.name}</td>
      <td>${a.studentId}</td>
      <td>${a.email}</td>
      <td>
        <select onchange="pDecision('${a.studentId}', this.value)" class="status-select ${a.pStatus}" style="width:100%;padding:6px;font-size:12px;border-radius:12px;border:none;cursor:pointer;font-weight:500;color:white">
          <option value="pending" ${a.pStatus === 'pending' ? 'selected' : ''}>pending</option>
          <option value="accepted" ${a.pStatus === 'accepted' ? 'selected' : ''}>accepted</option>
          <option value="rejected" ${a.pStatus === 'rejected' ? 'selected' : ''}>rejected</option>
        </select>
      </td>
      <td>
        <select onchange="fDecision('${a.studentId}', this.value)" class="status-select ${a.fStatus}" style="width:100%;padding:6px;font-size:12px;border-radius:12px;border:none;cursor:pointer;font-weight:500;color:white">
          <option value="pending" ${a.fStatus === 'pending' ? 'selected' : ''}>pending</option>
          <option value="final_accepted" ${a.fStatus === 'final_accepted' ? 'selected' : ''}>final accepted</option>
          <option value="final_rejected" ${a.fStatus === 'final_rejected' ? 'selected' : ''}>final rejected</option>
        </select>
      </td>
      <td>
        <select onchange="toggleAssignmentStatus('${a.studentId}', this.value)" class="status-select ${a.rejectedFromAssignment ? 'rejected' : 'accepted'}" style="width:100%;padding:6px;font-size:12px;border-radius:12px;border:none;cursor:pointer;font-weight:500;color:white">
          <option value="no" ${!a.rejectedFromAssignment ? 'selected' : ''}>allowed</option>
          <option value="yes" ${a.rejectedFromAssignment ? 'selected' : ''}>rejected</option>
        </select>
      </td>
    </tr>`).join('') || '<tr><td colspan=6>No applications yet.</td></tr>';
  document.getElementById('applications-table').innerHTML = `
    <table>
      <thead><tr>
        <th>Name</th><th>Student ID</th><th>Email</th>
        <th>Provisional</th><th>Final</th><th>Assign. Rejected</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function pDecision(sid, status) {
  const app = state.applications.find(a => a.studentId === sid);
  if (app) { app.pStatus = status; renderApplications(); }
}

function fDecision(sid, status) {
  const app = state.applications.find(a => a.studentId === sid);
  if (app) { app.fStatus = status; renderApplications(); }
}

function toggleAssignmentStatus(sid, value) {
  const app = state.applications.find(a => a.studentId === sid);
  if (app) { app.rejectedFromAssignment = value === 'yes'; renderApplications(); }
}

function renderReports() {
  const accepted = state.applications.filter(a =>
    a.pStatus === 'accepted' || a.fStatus === 'final_accepted');
  const rows = accepted.map(a => {
    const stu = state.students[a.studentId];
    const hasReport = stu && stu.reports.length > 0;
    const hasEval = stu && stu.evalSubmitted;
    return `<tr>
      <td>${a.name}</td><td>${a.studentId}</td>
      <td><span class="badge ${hasReport ? 'submitted' : 'missing'}">${hasReport ? 'Submitted' : 'Missing'}</span></td>
      <td><span class="badge ${hasEval   ? 'submitted' : 'missing'}">${hasEval   ? 'Submitted' : 'Missing'}</span></td>
      <td><span class="badge ${a.pStatus}">${a.pStatus}</span></td>
      <td><span class="badge ${a.fStatus}">${a.fStatus}</span></td>
    </tr>`;
  }).join('') || '<tr><td colspan=6>No accepted students.</td></tr>';
  document.getElementById('reports-table').innerHTML = `
    <table>
      <thead><tr><th>Name</th><th>Student ID</th><th>Report</th><th>Evaluation</th><th>Provisional</th><th>Final</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function saveDeadline() {
  const d = v('deadline-input');
  if (!d) return msg('deadline-msg', 'err', 'Please select a date.');
  state.deadline = d;
  msg('deadline-msg', 'ok', 'Deadline saved: ' + d);
}

function loadDeadline() {
  if (state.deadline) document.getElementById('deadline-input').value = state.deadline;
}

function renderReminders() {
  const missing = state.applications.filter(a => {
    if (a.pStatus !== 'accepted') return false;
    const stu = state.students[a.studentId];
    return !stu || stu.reports.length === 0;
  });
  const rows = missing.map(a => `
    <tr>
      <td>${a.name}</td><td>${a.studentId}</td><td>${a.email}</td>
      <td>${state.reminderLog.includes(a.studentId)
        ? '<span class="badge submitted">Sent</span>'
        : '<span class="badge pending">Pending</span>'}</td>
    </tr>`).join('') || '<tr><td colspan=4>No missing reports.</td></tr>';
  document.getElementById('reminders-list').innerHTML = `
    <table><thead><tr><th>Name</th><th>Student ID</th><th>Email</th><th>Reminder</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
}

function sendReminders() {
  const missing = state.applications.filter(a => {
    if (a.pStatus !== 'accepted') return false;
    const stu = state.students[a.studentId];
    return !stu || stu.reports.length === 0;
  });
  if (missing.length === 0) return msg('reminder-msg', 'ok', 'No missing reports found.');
  missing.forEach(a => {
    if (!state.reminderLog.includes(a.studentId)) state.reminderLog.push(a.studentId);
  });
  msg('reminder-msg', 'ok', `Reminders sent to ${missing.length} student(s). (simulated)`);
  renderReminders();
}

// utils
function v(id) { return document.getElementById(id).value.trim(); }
function clear(...ids) { ids.forEach(id => document.getElementById(id).value = ''); }
function msg(id, type, text) {
  const el = document.getElementById(id);
  el.innerHTML = `<div class="msg ${type}">${text}</div>`;
  setTimeout(() => {
    if (el.querySelector(`.msg.${type}`)?.textContent === text) el.innerHTML = '';
  }, 5000);
}
// demo panel funcs
function toggleDemoPanel() {
  const overlay = document.getElementById('demo-panel-overlay');
  overlay.classList.toggle('active');
  if (overlay.classList.contains('active')) {
    updateDemoLists();
  }
}

function setupDemoStudent() {
  const sid = 'DEMO001';
  const name = 'Demo Student';
  const app = { id: Date.now(), name, studentId: sid, email: 'demo@student.com', pStatus: 'accepted', fStatus: 'pending', rejectedFromAssignment: false };
  if (!state.applications.find(a => a.studentId === sid)) {
    state.applications.push(app);
    state.students[sid] = { password: sid, reports: [], evalSubmitted: false };
  }
  state.currentUser = { role: 'student', id: sid };
  setNavUser('Student: ' + name);
  document.getElementById('nav-student').style.display = '';
  showPage('student-portal');
  renderMyStatus();
  updateDemoLists();
  const msg_el = document.getElementById('demo-message');
  msg_el.textContent = 'demo student loaded! id: ' + sid + ', pw: ' + sid;
  msg_el.className = 'demo-msg success';
}

function setupDemoSupervisor() {
  const sup = { name: 'Demo Supervisor', company: 'Demo Corp', email: 'demo@sup.com', password: 'demo123' };
  if (!state.supervisors.find(s => s.email === sup.email)) {
    state.supervisors.push(sup);
  }
  state.currentSupervisor = state.supervisors.find(s => s.email === sup.email);
  setNavUser('Supervisor: ' + sup.name);
  document.querySelectorAll('[id^="sup-"]').forEach(s => {
    if (s.classList.contains('section')) s.classList.remove('active');
  });
  document.getElementById('sup-eval').classList.add('active');
  msg('sup-msg', 'ok', 'logged in! submit your evaluation below.');
  showPage('supervisor-register');
  updateDemoLists();
  const msg_el = document.getElementById('demo-message');
  msg_el.textContent = 'demo supervisor loaded! email: ' + sup.email + ', pw: demo123';
  msg_el.className = 'demo-msg success';
}

function setupDemoCoord() {
  state.currentUser = { role: 'coord' };
  setNavUser('Coordinator');
  document.getElementById('nav-coord').style.display = '';
  showPage('coordinator');
  renderApplications();
  renderReports();
  renderReminders();
  renderSupervisorsList();
  loadDeadline();
  updateDemoLists();
  const msg_el = document.getElementById('demo-message');
  msg_el.textContent = 'demo coordinator loaded! user: coord, pw: coord123';
  msg_el.className = 'demo-msg success';
}

function clearDemoData() {
  if (!confirm('clear all demo data? this will reset all apps, reports, evals, and supervisors.')) {
    return;
  }
  state.applications = [];
  state.students = {};
  state.supervisors = [];
  state.deadline = null;
  state.reminderLog = [];
  state.currentUser = null;
  state.currentSupervisor = null;
  logout();
  const msg_el = document.getElementById('demo-message');
  msg_el.textContent = 'all demo data cleared!';
  msg_el.className = 'demo-msg success';
  updateDemoLists();
}

// demo list utilities
function populateRandomStudents() {
  const count = parseInt(document.getElementById('populate-count').value) || 5;
  const firstNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry', 'Iris', 'Jack'];
  const lastNames = ['Smith', 'Johnson', 'Brown', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor', 'Anderson', 'Thomas'];
  
  for (let i = 0; i < count; i++) {
    const fname = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lname = lastNames[Math.floor(Math.random() * lastNames.length)];
    const name = fname + ' ' + lname;
    const sid = '100' + Math.floor(100000 + Math.random() * 900000);
    const email = fname.toLowerCase() + '.' + lname.toLowerCase() + '@university.edu';
    
    if (!state.applications.find(a => a.studentId === sid)) {
      const app = { id: Date.now() + i, name, studentId: sid, email, pStatus: 'accepted', fStatus: 'pending', rejectedFromAssignment: false };
      state.applications.push(app);
      state.students[sid] = { password: sid, reports: [], evalSubmitted: false };
    }
  }
  updateDemoLists();
  const msg_el = document.getElementById('demo-message');
  msg_el.textContent = count + ' random students created!';
  msg_el.className = 'demo-msg success';
}

function updateDemoLists() {
  // update students list
  const studentsList = document.getElementById('demo-students-list');
  if (state.applications.length === 0) {
    studentsList.innerHTML = '<em style="color: #999;">none</em>';
  } else {
    studentsList.innerHTML = state.applications.map(app => 
      `<div style="margin: 4px 0; font-family: monospace; color: #333; font-size: 11px;"><strong>id:</strong> ${app.studentId} | <strong>pw:</strong> ${app.studentId}</div>`
    ).join('');
  }
  
  // update supervisors list
  const supsList = document.getElementById('demo-supervisors-list');
  if (state.supervisors.length === 0) {
    supsList.innerHTML = '<em style="color: #999;">none</em>';
  } else {
    supsList.innerHTML = state.supervisors.map(sup => 
      `<div style="margin: 4px 0; font-family: monospace; color: #333; font-size: 11px;"><strong>email:</strong> ${sup.email} | <strong>pw:</strong> ${sup.password}</div>`
    ).join('');
  }
}

// call updateDemoLists when app loads
document.addEventListener('DOMContentLoaded', updateDemoLists);