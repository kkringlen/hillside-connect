(function () {
  'use strict';

  const STORAGE_KEY = 'hillside-connect-demo-v2';
  const SESSION_KEY = 'hillside-connect-demo-session-v2';
  const PASSWORD = 'Demo123!';

  const ids = {
    admin: '11111111-1111-4111-8111-111111111111',
    leader: '22222222-2222-4222-8222-222222222222',
    member: '33333333-3333-4333-8333-333333333333',
    guest: '44444444-4444-4444-8444-444444444444',
    youth: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    worship: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    building: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  };

  function now(offsetDays) {
    const value = new Date();
    value.setDate(value.getDate() + (offsetDays || 0));
    return value.toISOString();
  }
  function uuid() {
    return crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    });
  }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  function seed() {
    return {
      users: {
        [ids.admin]: { id: ids.admin, full_name: 'Kevin Admin', role: 'admin', status: 'active', directory_email: 'admin@demo.local', directory_phone: '(405) 555-0100', show_email: true, show_phone: true, notification_preferences: { announcements: true, events: true, team_notices: true, discussions: true, prayer: true, hidden_team_ids: [] }, email: 'admin@demo.local', phone: '+14055550100' },
        [ids.leader]: { id: ids.leader, full_name: 'Wes Leader', role: 'leader', status: 'active', directory_email: 'leader@demo.local', directory_phone: '(405) 555-0110', show_email: true, show_phone: true, notification_preferences: { announcements: true, events: true, team_notices: true, discussions: true, prayer: true, hidden_team_ids: [] }, email: 'leader@demo.local', phone: '+14055550110' },
        [ids.member]: { id: ids.member, full_name: 'Danae Member', role: 'member', status: 'active', directory_email: null, directory_phone: '(405) 555-0120', show_email: false, show_phone: true, notification_preferences: { announcements: true, events: true, team_notices: true, discussions: true, prayer: true, hidden_team_ids: [] }, email: 'member@demo.local', phone: '+14055550120' },
        [ids.guest]: { id: ids.guest, full_name: 'Pending Guest', role: 'guest', status: 'pending', directory_email: null, directory_phone: null, show_email: false, show_phone: false, notification_preferences: { announcements: true, events: true, team_notices: true, discussions: true, prayer: true, hidden_team_ids: [] }, email: 'guest@demo.local', phone: '+14055550130' }
      },
      teams: [
        { id: ids.youth, slug: 'youth', name: 'Youth Team', description: 'Youth ministry leaders and volunteers.', active: true },
        { id: ids.worship, slug: 'worship', name: 'Worship Team', description: 'Worship leaders, musicians, and production volunteers.', active: true },
        { id: ids.building, slug: 'building-grounds', name: 'Building & Grounds', description: 'Facilities, maintenance, and property needs.', active: true }
      ],
      memberships: [
        { team_id: ids.youth, user_id: ids.admin, team_role: 'leader' },
        { team_id: ids.worship, user_id: ids.admin, team_role: 'leader' },
        { team_id: ids.building, user_id: ids.admin, team_role: 'leader' },
        { team_id: ids.youth, user_id: ids.leader, team_role: 'leader' },
        { team_id: ids.worship, user_id: ids.leader, team_role: 'leader' },
        { team_id: ids.youth, user_id: ids.member, team_role: 'member' }
      ],
      announcements: [
        { id: uuid(), title: 'Welcome to Hillside Connect', body: 'This is a production-style demo using local sample data. Announcements can be public, member-only, leader-only, or limited to a team.', audience: 'public', team_id: null, author_id: ids.admin, created_at: now(-1) },
        { id: uuid(), title: 'Member fellowship meal', body: 'Please check the calendar and RSVP with your ministry leader if you can help with setup.', audience: 'members', team_id: null, author_id: ids.admin, created_at: now(-2) },
        { id: uuid(), title: 'Youth volunteer reminder', body: 'All youth volunteers should arrive 20 minutes before Wednesday activities.', audience: 'team', team_id: ids.youth, author_id: ids.leader, created_at: now(-3) }
      ],
      events: [
        { id: uuid(), title: 'Sunday Worship', description: 'Weekly worship service.', starts_at: nextWeekday(0, 10, 30), ends_at: nextWeekday(0, 12, 0), location: 'Hillside Baptist Church', audience: 'public', team_id: null, author_id: ids.admin, created_at: now(-5) },
        { id: uuid(), title: 'Youth Team Planning Meeting', description: 'Planning for next month activities.', starts_at: now(5), ends_at: now(5), location: 'Youth Room', audience: 'team', team_id: ids.youth, author_id: ids.leader, created_at: now(-1) }
      ],
      prayers: [
        { id: uuid(), requester_id: ids.member, requester_name: 'Danae Member', body: 'Please pray for a family in our community going through a difficult season.', visibility: 'members', status: 'approved', created_at: now(-1) },
        { id: uuid(), requester_id: ids.guest, requester_name: 'Pending Guest', body: 'Private request for church leadership.', visibility: 'leadership', status: 'pending', created_at: now(0) }
      ],
      conversations: [{ id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', created_by: ids.admin, created_at: now(-1) }],
      conversationMembers: [
        { conversation_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', user_id: ids.admin },
        { conversation_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', user_id: ids.leader }
      ],
      messages: [
        { id: uuid(), conversation_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', sender_id: ids.admin, body: 'Can you confirm the youth team meeting agenda?', created_at: now(-1) },
        { id: uuid(), conversation_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', sender_id: ids.leader, body: 'Yes. I will post the final agenda in the team discussion.', created_at: now(-1) }
      ],
      notices: [
        { id: uuid(), team_id: ids.youth, author_id: ids.leader, title: 'Team meeting scheduled', body: 'Our next planning meeting is Thursday evening. Please review the discussion topics before arriving.', meeting_at: now(5), location: 'Youth Room', created_at: now(-1) }
      ],
      discussions: [
        { id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', team_id: ids.youth, author_id: ids.leader, title: 'Fall outreach ideas', body: 'Post activity ideas and volunteer needs here so we can prepare before the meeting.', created_at: now(-2) }
      ],
      comments: [
        { id: uuid(), discussion_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', author_id: ids.member, body: 'I can help organize games and registration.', created_at: now(-1) }
      ]
    };
  }

  function nextWeekday(day, hour, minute) {
    const date = new Date();
    let add = (day - date.getDay() + 7) % 7;
    if (add === 0 && (date.getHours() > hour || (date.getHours() === hour && date.getMinutes() >= minute))) add = 7;
    date.setDate(date.getDate() + add);
    date.setHours(hour, minute, 0, 0);
    return date.toISOString();
  }

  function read() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (parsed && parsed.users) return parsed;
    } catch (_) {}
    const value = seed();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    return value;
  }
  function write(data) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
  function session() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (_) { return null; }
  }
  function setSession(value) { if (value) localStorage.setItem(SESSION_KEY, JSON.stringify(value)); else localStorage.removeItem(SESSION_KEY); }
  function userByIdentifier(data, identifier) {
    const input = String(identifier || '').trim().toLowerCase();
    return Object.values(data.users).find((u) => String(u.email || '').toLowerCase() === input || String(u.phone || '').replace(/\D/g, '') === input.replace(/\D/g, ''));
  }
  function activeUser(data) { const s = session(); return s ? data.users[s.user.id] || null : null; }
  function currentId(data) { return activeUser(data)?.id || null; }
  function isAdmin(data) { return activeUser(data)?.role === 'admin'; }
  function isLeader(data) { return ['admin', 'leader'].includes(activeUser(data)?.role); }
  function myMemberships(data) { const id = currentId(data); return data.memberships.filter((m) => m.user_id === id); }
  function myTeamIds(data) { return myMemberships(data).map((m) => m.team_id); }
  function canSeeAudience(data, item) {
    if (item.audience === 'public') return true;
    const user = activeUser(data);
    if (!user || user.status !== 'active' || user.role === 'guest') return false;
    if (user.role === 'admin') return true;
    if (item.audience === 'members') return true;
    if (item.audience === 'leaders') return user.role === 'leader';
    return item.audience === 'team' && myTeamIds(data).includes(item.team_id);
  }
  function canManageTeam(data, teamId) {
    if (isAdmin(data)) return true;
    const id = currentId(data);
    return activeUser(data)?.role === 'leader' && data.memberships.some((m) => m.user_id === id && m.team_id === teamId && m.team_role === 'leader');
  }
  function canManageAudience(data, audience, teamId) {
    if (isAdmin(data)) return true;
    if (activeUser(data)?.role !== 'leader') return false;
    if (audience === 'public') return false;
    return audience !== 'team' || canManageTeam(data, teamId);
  }

  function createDemoApi() {
    const listeners = new Set();
    function emit() { listeners.forEach((callback) => callback(session())); }
    function asyncClone(value) { return Promise.resolve(clone(value)); }
    function updateCollection(name, record, extra) {
      const data = read();
      const item = { ...record, ...extra };
      if (record.id) {
        const index = data[name].findIndex((x) => x.id === record.id);
        if (index >= 0) data[name][index] = { ...data[name][index], ...item, updated_at: now(0) };
      } else {
        item.id = uuid();
        item.created_at = now(0);
        data[name].unshift(item);
      }
      write(data);
      return clone(item);
    }
    function remove(name, id) { const data = read(); data[name] = data[name].filter((x) => x.id !== id); write(data); }

    return {
      kind: 'demo',
      isConfigured: () => true,
      normalizePhone: (value) => value,
      async getSession() { return clone(session()); },
      onAuthStateChange(callback) { listeners.add(callback); return () => listeners.delete(callback); },
      async signIn(identifier, password) {
        const data = read();
        const user = userByIdentifier(data, identifier);
        if (!user || password !== PASSWORD) throw new Error('Use a demo account and the password Demo123!.');
        const value = { user: { id: user.id, email: user.email, phone: user.phone } };
        setSession(value); emit(); return clone(value);
      },
      async signUp(fullName, identifier, password) {
        if (String(password || '').length < 8) throw new Error('Password must be at least 8 characters.');
        const data = read();
        if (userByIdentifier(data, identifier)) throw new Error('That email or phone is already in use.');
        const id = uuid();
        const email = String(identifier).includes('@') ? String(identifier).toLowerCase() : null;
        const phone = email ? null : String(identifier);
        data.users[id] = { id, full_name: String(fullName).trim(), role: 'guest', status: 'pending', directory_email: null, directory_phone: null, show_email: false, show_phone: false, notification_preferences: { announcements: true, events: true, team_notices: true, discussions: true, prayer: true, hidden_team_ids: [] }, email, phone };
        write(data);
        const value = { user: { id, email, phone } };
        setSession(value); emit(); return clone(value);
      },
      async signOut() { setSession(null); emit(); },
      async resetPassword() {},
      async updatePassword() {},
      async updateEmail(email) { const data = read(); const id = currentId(data); data.users[id].email = email; write(data); },
      async updatePhone(phone) { const data = read(); const id = currentId(data); data.users[id].phone = phone; write(data); return phone; },
      async verifyPhoneChange() {},
      async verifyPhoneSignup() {},
      async getProfile(userId) { return asyncClone(read().users[userId] || null); },
      async getOwnPrivateProfile(userId) { const u = read().users[userId]; return asyncClone(u ? { email: u.email, phone: u.phone } : null); },
      async listProfiles() { return asyncClone(Object.values(read().users).filter((u) => u.status === 'active' && u.role !== 'guest')); },
      async listAnnouncements() { const data = read(); return asyncClone(data.announcements.filter((a) => canSeeAudience(data, a))); },
      async saveAnnouncement(record, userId) { const data = read(); if (!canManageAudience(data, record.audience, record.team_id)) throw new Error('You do not have permission.'); return updateCollection('announcements', record, { author_id: userId, team_id: record.audience === 'team' ? record.team_id : null }); },
      async deleteAnnouncement(id) { remove('announcements', id); },
      async listEvents() { const data = read(); return asyncClone(data.events.filter((e) => canSeeAudience(data, e))); },
      async saveEvent(record, userId) { const data = read(); if (!canManageAudience(data, record.audience, record.team_id)) throw new Error('You do not have permission.'); return updateCollection('events', record, { author_id: userId, team_id: record.audience === 'team' ? record.team_id : null }); },
      async deleteEvent(id) { remove('events', id); },
      async listTeams() { const data = read(); if (isAdmin(data)) return asyncClone(data.teams); const teamIds = myTeamIds(data); return asyncClone(data.teams.filter((t) => teamIds.includes(t.id))); },
      async listTeamMemberships() { const data = read(); if (isAdmin(data)) return asyncClone(data.memberships); const teamIds = myTeamIds(data); return asyncClone(data.memberships.filter((m) => teamIds.includes(m.team_id))); },
      async listTeamNotices() { const data = read(); const teamIds = isAdmin(data) ? data.teams.map((t) => t.id) : myTeamIds(data); return asyncClone(data.notices.filter((n) => teamIds.includes(n.team_id))); },
      async saveTeamNotice(record, userId) { const data = read(); if (!canManageTeam(data, record.team_id)) throw new Error('You do not lead this team.'); return updateCollection('notices', record, { author_id: userId }); },
      async deleteTeamNotice(id) { remove('notices', id); },
      async listTeamDiscussions() { const data = read(); const teamIds = isAdmin(data) ? data.teams.map((t) => t.id) : myTeamIds(data); return asyncClone(data.discussions.filter((d) => teamIds.includes(d.team_id))); },
      async saveDiscussion(record, userId) { const data = read(); if (!canManageTeam(data, record.team_id)) throw new Error('You do not lead this team.'); return updateCollection('discussions', record, { author_id: userId }); },
      async deleteDiscussion(id) { remove('discussions', id); },
      async listDiscussionComments() { return asyncClone(read().comments); },
      async addDiscussionComment(discussionId, body, userId) { return updateCollection('comments', { discussion_id: discussionId, body }, { author_id: userId }); },
      async deleteDiscussionComment(id) { remove('comments', id); },
      async listPrayers() {
        const data = read(); const user = activeUser(data);
        if (!user) return [];
        if (['admin', 'leader'].includes(user.role)) return asyncClone(data.prayers);
        if (user.status === 'active' && user.role === 'member') return asyncClone(data.prayers.filter((p) => (p.visibility === 'members' && p.status === 'approved') || p.requester_id === user.id));
        return asyncClone(data.prayers.filter((p) => p.requester_id === user.id));
      },
      async submitPrayer(record, userId) { return updateCollection('prayers', record, { requester_id: userId || null, status: 'pending' }); },
      async updatePrayer(id, changes) { const data = read(); const item = data.prayers.find((p) => p.id === id); if (!item || !isLeader(data)) throw new Error('Leader access required.'); Object.assign(item, changes, { updated_at: now(0) }); write(data); return clone(item); },
      async deletePrayer(id) { remove('prayers', id); },
      async listDirectory() {
        const data = read(); const viewer = activeUser(data); if (!viewer || viewer.status !== 'active' || viewer.role === 'guest') return [];
        const leadTeams = data.memberships.filter((m) => m.user_id === viewer.id && m.team_role === 'leader').map((m) => m.team_id);
        return asyncClone(Object.values(data.users).filter((u) => u.status === 'active' && u.role !== 'guest').map((u) => {
          const targetTeams = data.memberships.filter((m) => m.user_id === u.id).map((m) => m.team_id);
          const privileged = viewer.role === 'admin' || (viewer.role === 'leader' && targetTeams.some((id) => leadTeams.includes(id)));
          return { id: u.id, full_name: u.full_name, role: u.role, email: privileged ? u.email : u.directory_email, phone: privileged ? u.phone : u.directory_phone, team_ids: targetTeams };
        }));
      },
      async listDirectRecipients() {
        const data = read(); const user = activeUser(data); if (!user || user.status !== 'active' || user.role === 'guest') return [];
        const myTeams = myTeamIds(data);
        return asyncClone(Object.values(data.users).filter((u) => u.id !== user.id && u.status === 'active' && u.role !== 'guest' && (user.role === 'admin' || u.role === 'admin' || data.memberships.some((m) => m.user_id === u.id && myTeams.includes(m.team_id)))).map((u) => ({ id: u.id, full_name: u.full_name, role: u.role })));
      },
      async listConversations() {
        const data = read(); const id = currentId(data);
        const memberRows = data.conversationMembers.filter((m) => m.user_id === id);
        const convIds = memberRows.map((m) => m.conversation_id);
        return asyncClone({ conversations: data.conversations.filter((c) => convIds.includes(c.id)), members: data.conversationMembers.filter((m) => convIds.includes(m.conversation_id)), messages: data.messages.filter((m) => convIds.includes(m.conversation_id)) });
      },
      async startConversation(targetUser, body) {
        const data = read(); const id = currentId(data); const conversationId = uuid();
        data.conversations.push({ id: conversationId, created_by: id, created_at: now(0) });
        data.conversationMembers.push({ conversation_id: conversationId, user_id: id }, { conversation_id: conversationId, user_id: targetUser });
        data.messages.push({ id: uuid(), conversation_id: conversationId, sender_id: id, body, created_at: now(0) });
        write(data); return conversationId;
      },
      async sendMessage(conversationId, body, userId) { return updateCollection('messages', { conversation_id: conversationId, body }, { sender_id: userId }); },
      async updateProfile(userId, changes) {
        const data = read(); Object.assign(data.users[userId], changes);
        const u = data.users[userId]; u.directory_email = u.show_email ? u.email : null; u.directory_phone = u.show_phone ? u.phone : null;
        write(data); return clone(u);
      },
      async listAdminPeople() {
        const data = read(); if (!isAdmin(data)) throw new Error('Administrator access required.');
        return asyncClone(Object.values(data.users).map((u) => ({ id: u.id, full_name: u.full_name, role: u.role, status: u.status, email: u.email, phone: u.phone, team_ids: data.memberships.filter((m) => m.user_id === u.id).map((m) => m.team_id), team_roles: Object.fromEntries(data.memberships.filter((m) => m.user_id === u.id).map((m) => [m.team_id, m.team_role])), created_at: now(-3) })));
      },
      async adminUpdatePerson(userId, changes) { const data = read(); if (!isAdmin(data)) throw new Error('Administrator access required.'); Object.assign(data.users[userId], changes); write(data); return clone(data.users[userId]); },
      async adminSetTeamMemberships(userId, memberships) {
        const data = read(); if (!isAdmin(data)) throw new Error('Administrator access required.');
        data.memberships = data.memberships.filter((m) => m.user_id !== userId);
        memberships.forEach((m) => data.memberships.push({ team_id: m.team_id, user_id: userId, team_role: m.team_role || 'member' }));
        write(data);
      },
      subscribe(callback) { const timer = setInterval(() => callback({}), 30000); return () => clearInterval(timer); },
      resetDemo() { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(SESSION_KEY); }
    };
  }

  window.HillsideDemo = { createDemoApi, PASSWORD };
})();
