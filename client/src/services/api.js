// ব্যাকএন্ডের সাথে কথা বলার সহায়ক ফাংশন
const base = '/api';

async function request(path, options = {}) {
  // localStorage থেকে টোকেন নাও
  const token = localStorage.getItem('auth_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${base}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    // 401 হলে টোকেন মুছে ফেলো (মেয়াদোত্তীর্ণ বা অবৈধ)
    if (res.status === 401 && token) {
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    throw new Error(err.error || 'সার্ভার ত্রুটি');
  }
  return res.json();
}

export const api = {
  // রোগী
  getPatients: (q) => request(`/patients${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  getPatient: (id) => request(`/patients/${id}`),
  getPatientProfile: (id) => request(`/patients/${id}/profile`),
  addPatient: (data) => request('/patients', { method: 'POST', body: JSON.stringify(data) }),
  updatePatient: (id, data) =>
    request(`/patients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePatient: (id) => request(`/patients/${id}`, { method: 'DELETE' }),

  // ওষুধ
  getRemedies: () => request('/remedies'),
  getRemedy: (id) => request(`/remedies/${id}`),
  getRemedyRubrics: (id) => request(`/remedies/${id}/rubrics`),

  // রুব্রিক
  getRubrics: (section) => request(`/rubrics${section ? `?section=${encodeURIComponent(section)}` : ''}`),
  getSections: () => request('/rubrics/sections'),
  getRubricRemedies: (id) => request(`/rubrics/${id}/remedies`),

  // বিশ্লেষণ
  analyze: (rubricIds) =>
    request('/analysis', { method: 'POST', body: JSON.stringify({ rubricIds }) }),

  // কেস ও প্রেসক্রিপশন
  getCases: (patientId) => request(`/cases?patient_id=${patientId}`),
  getRecentCases: (limit = 5) => request(`/cases/recent?limit=${limit}`),
  getCase: (id) => request(`/cases/${id}`),
  addCase: (data) => request('/cases', { method: 'POST', body: JSON.stringify(data) }),
  updateCase: (id, data) =>
    request(`/cases/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCase: (id) => request(`/cases/${id}`, { method: 'DELETE' }),
  addPrescription: (caseId, data) =>
    request(`/cases/${caseId}/prescriptions`, { method: 'POST', body: JSON.stringify(data) }),
  updatePrescription: (caseId, prescriptionId, data) =>
    request(`/cases/${caseId}/prescriptions/${prescriptionId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deletePrescription: (caseId, prescriptionId) =>
    request(`/cases/${caseId}/prescriptions/${prescriptionId}`, { method: 'DELETE' }),

  // সেটিংস (ক্লিনিকের পরিচয়)
  getSettings: () => request('/settings'),
  updateSettings: (data) =>
    request('/settings', { method: 'PUT', body: JSON.stringify(data) }),

  // ব্যাকআপ
  exportBackup: () => request('/backup/export'),
  importBackup: (data) =>
    request('/backup/import', { method: 'POST', body: JSON.stringify(data) }),

  // auth
  login: (password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ password }) }),
  changePassword: (currentPassword, newPassword) =>
    request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
};
