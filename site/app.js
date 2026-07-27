(function () {
  'use strict';

  const root = document.getElementById('app');
  const modalRoot = document.getElementById('modal-root');
  const toastRoot = document.getElementById('toast-root');
  const config = window.HILLSIDE_CONFIG || {};
  const church = window.HILLSIDE_CHURCH || {};
  const demoMode = window.HILLSIDE_TEST_DEMO === true || (config.ENABLE_DEMO_MODE === true && new URLSearchParams(location.search).get('demo') === '1');

  const state = {
    api: null,
    booting: true,
    busy: false,
    session: null,
    profile: null,
    privateProfile: null,
    publicMode: false,
    authMode: 'login',
    tab: 'home',
    moreView: 'menu',
    selectedTeam: null,
    teamView: 'notices',
    selectedConversation: null,
    selectedDiscussion: null,
    data: emptyData(),
    unsubscribeAuth: null,
    unsubscribeRealtime: null
  };

  function emptyData() {
    return {
      announcements: [], events: [], profiles: [], teams: [], memberships: [], notices: [], discussions: [], comments: [], prayers: [],
      directory: [], recipients: [], conversations: [], conversationMembers: [], messages: [], adminPeople: []
    };
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  function attr(value) { return esc(value); }
  function nl(value) { return esc(value).replace(/\n/g, '<br>'); }
  function id() { return state.profile && state.profile.id; }
  function isAuthenticated() { return Boolean(state.session && state.session.user); }
  function isActiveMember() { return Boolean(state.profile && state.profile.status === 'active' && ['admin', 'leader', 'member'].includes(state.profile.role)); }
  function isAdmin() { return state.profile && state.profile.role === 'admin' && state.profile.status === 'active'; }
  function isLeader() { return state.profile && ['admin', 'leader'].includes(state.profile.role) && state.profile.status === 'active'; }
  function isPending() { return state.profile && state.profile.status === 'pending'; }
  function currentUserName() { return state.profile ? state.profile.full_name : 'Guest'; }
  function profileById(userId) { return state.data.profiles.find((p) => p.id === userId) || state.data.adminPeople.find((p) => p.id === userId) || (state.profile && state.profile.id === userId ? state.profile : null); }
  function nameById(userId) { return profileById(userId)?.full_name || 'Hillside member'; }
  function teamById(teamId) { return state.data.teams.find((t) => t.id === teamId); }
  function teamName(teamId) { return teamById(teamId)?.name || 'Team'; }
  function myMembership(teamId) { return state.data.memberships.find((m) => m.user_id === id() && m.team_id === teamId); }
  function canManageTeam(teamId) { return isAdmin() || (state.profile?.role === 'leader' && myMembership(teamId)?.team_role === 'leader'); }
  function canCreateChurchContent() { return isLeader(); }
  function canEditItem(item) { return isAdmin() || item.author_id === id() || (item.team_id && canManageTeam(item.team_id)); }

  function fmtDate(value, includeTime) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return esc(value);
    return new Intl.DateTimeFormat('en-US', includeTime
      ? { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
      : { weekday: 'short', month: 'short', day: 'numeric' }).format(date);
  }
  function toLocalInput(value) {
    if (!value) return '';
    const date = new Date(value);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }
  function fromLocalInput(value) { return value ? new Date(value).toISOString() : null; }
  function initials(name) { return String(name || '?').trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase(); }
  function roleLabel(role) { return ({ admin: 'Admin', leader: 'Leader', member: 'Member', guest: 'Guest' })[role] || 'Member'; }
  function audienceLabel(item) {
    if (item.audience === 'public') return 'Public';
    if (item.audience === 'members') return 'Members';
    if (item.audience === 'leaders') return 'Leaders';
    if (item.audience === 'team') return teamName(item.team_id);
    return 'Members';
  }
  function badge(text, type) { return `<span class="badge ${type || ''}">${esc(text)}</span>`; }
  function avatar(name) { return `<span class="avatar" aria-hidden="true">${esc(initials(name))}</span>`; }
  function empty(icon, title, body) { return `<div class="empty"><div class="empty-icon">${icon}</div><h3>${esc(title)}</h3><p>${esc(body)}</p></div>`; }
  function pageHead(title, subtitle, action) {
    return `<div class="page-head"><div><h1 class="page-title">${esc(title)}</h1>${subtitle ? `<p class="page-subtitle">${esc(subtitle)}</p>` : ''}</div>${action || ''}</div>`;
  }
  function toast(message, type) {
    toastRoot.innerHTML = `<div class="toast ${type === 'error' ? 'error' : ''}">${esc(message)}</div>`;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toastRoot.innerHTML = ''; }, 4200);
  }
  function setBusy(value) { state.busy = value; document.querySelectorAll('button[type="submit"]').forEach((button) => { button.disabled = value; }); }
  function handleError(error) { console.error(error); toast(error?.message || 'Something went wrong.', 'error'); }

  async function initialize() {
    try {
      if (demoMode) state.api = window.HillsideDemo.createDemoApi();
      else {
        const configured = window.HillsideSupabase && window.HillsideSupabase.assertConfigured(config);
        if (!configured) {
          state.booting = false;
          renderSetup();
          return;
        }
        state.api = window.HillsideSupabase.createSupabaseApi(config);
      }

      state.session = await state.api.getSession();
      if (state.session?.user) await hydrateUser(state.session.user.id);
      state.unsubscribeAuth = state.api.onAuthStateChange(async (session) => {
        const previousId = state.session?.user?.id;
        state.session = session;
        if (session?.user) {
          if (previousId !== session.user.id || !state.profile) await hydrateUser(session.user.id);
          await refreshAll(true);
        } else {
          state.profile = null;
          state.privateProfile = null;
          state.data = emptyData();
          state.tab = 'home';
          state.publicMode = false;
        }
        render();
      });
      state.booting = false;
      if (state.session?.user) await refreshAll(true);
      else await refreshPublic(true);
      render();
    } catch (error) {
      state.booting = false;
      root.innerHTML = `<div class="auth-wrap"><div class="auth-card"><div class="auth-logo">✝</div><h1>Unable to start</h1><p class="lead">${esc(error.message)}</p><div class="notice">Check config.js, your Supabase project status, and the browser console.</div></div></div>`;
    }
  }

  async function hydrateUser(userId) {
    state.profile = await state.api.getProfile(userId);
    state.privateProfile = await state.api.getOwnPrivateProfile(userId);
    if (!state.profile) throw new Error('Your authentication account exists, but its member profile was not created. Run the supplied Supabase migration and sign in again.');
    if (state.profile.status === 'deactivated') {
      await state.api.signOut();
      throw new Error('This account has been deactivated. Contact a Hillside administrator.');
    }
  }

  async function refreshPublic(silent) {
    if (!silent) state.busy = true;
    try {
      const [announcements, events] = await Promise.all([state.api.listAnnouncements(), state.api.listEvents()]);
      state.data.announcements = announcements;
      state.data.events = events;
    } finally {
      state.busy = false;
    }
  }

  async function refreshAll(silent) {
    if (!state.session?.user) return refreshPublic(silent);
    if (!silent) state.busy = true;
    try {
      const active = isActiveMember();
      const baseTasks = [
        state.api.listAnnouncements(), state.api.listEvents(), state.api.listPrayers()
      ];
      const activeTasks = active ? [
        state.api.listProfiles(), state.api.listTeams(), state.api.listTeamMemberships(), state.api.listTeamNotices(),
        state.api.listTeamDiscussions(), state.api.listDiscussionComments(), state.api.listDirectory(),
        state.api.listDirectRecipients(), state.api.listConversations()
      ] : [];
      const results = await Promise.all([...baseTasks, ...activeTasks]);
      state.data.announcements = results[0] || [];
      state.data.events = results[1] || [];
      state.data.prayers = results[2] || [];
      if (active) {
        state.data.profiles = results[3] || [];
        state.data.teams = results[4] || [];
        state.data.memberships = results[5] || [];
        state.data.notices = results[6] || [];
        state.data.discussions = results[7] || [];
        state.data.comments = results[8] || [];
        state.data.directory = results[9] || [];
        state.data.recipients = results[10] || [];
        const conversations = results[11] || { conversations: [], members: [], messages: [] };
        state.data.conversations = conversations.conversations || [];
        state.data.conversationMembers = conversations.members || [];
        state.data.messages = conversations.messages || [];
        if (isAdmin()) state.data.adminPeople = await state.api.listAdminPeople();
      }
      if (state.unsubscribeRealtime) state.unsubscribeRealtime();
      state.unsubscribeRealtime = state.api.subscribe(() => scheduleRefresh());
    } finally {
      state.busy = false;
      if (!silent) render();
    }
  }

  function scheduleRefresh() {
    clearTimeout(scheduleRefresh._timer);
    scheduleRefresh._timer = setTimeout(async () => {
      try { await refreshAll(true); render(); } catch (error) { console.warn('Realtime refresh failed', error); }
    }, 500);
  }

  function render() {
    if (state.booting) {
      root.innerHTML = '<div class="loading-screen"><div><div class="spinner"></div><p>Loading Hillside Connect…</p></div></div>';
      return;
    }
    if (!state.api) return renderSetup();
    if (!isAuthenticated() && !state.publicMode) return renderAuth();
    renderShell();
  }

  function renderSetup() {
    root.innerHTML = `<div class="auth-wrap"><div class="auth-card">
      <div class="auth-logo">⚙</div><h1>Supabase setup required</h1>
      <p class="lead">The production app is installed, but config.js still contains placeholder values.</p>
      <div class="notice"><strong>Complete these steps:</strong><br>1. Run <code>supabase/migrations/001_initial_schema.sql</code> in Supabase SQL Editor.<br>2. Copy your Project URL and publishable key into <code>config.js</code>.<br>3. Reload this page.</div>
      ${config.ENABLE_DEMO_MODE === true ? `<div class="item-actions"><a class="button primary block" href="?demo=1">Open demo mode</a></div>` : ''}
    </div></div>`;
  }

  function renderAuth() {
    const signup = state.authMode === 'signup';
    root.innerHTML = `<div class="auth-wrap"><div class="auth-card">
      <div class="auth-logo">✝</div><h1>Hillside Connect</h1>
      <p class="lead">Church information, events, prayer requests, teams, and member communication.</p>
      <div class="segmented"><button data-action="auth-mode" data-mode="login" class="${signup ? '' : 'active'}">Log in</button><button data-action="auth-mode" data-mode="signup" class="${signup ? 'active' : ''}">Create account</button></div>
      ${demoMode ? `<div class="notice"><strong>Demo accounts</strong><br>admin@demo.local, leader@demo.local, member@demo.local, or guest@demo.local<br>Password: <strong>${esc(window.HillsideDemo.PASSWORD)}</strong></div><br>` : ''}
      <form class="form-grid" data-form="auth-${signup ? 'signup' : 'login'}">
        ${signup ? `<div class="field"><label for="auth-name">Full name</label><input id="auth-name" name="name" autocomplete="name" required minlength="2" maxlength="120"></div>` : ''}
        <div class="field"><label for="auth-id">Email address or mobile phone</label><input id="auth-id" name="identifier" autocomplete="username" required placeholder="name@example.com or (405) 555-0123"><div class="help">Phone signup and login require an SMS provider configured in Supabase.</div></div>
        <div class="field"><label for="auth-password">Password</label><input id="auth-password" name="password" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" required minlength="8"></div>
        <button class="button primary block" type="submit">${signup ? 'Create guest account' : 'Log in'}</button>
      </form>
      ${!signup ? `<button class="button secondary block" style="margin-top:9px" data-action="forgot-password">Forgot password</button>` : `<div class="help" style="margin-top:12px">New accounts begin as guests. An administrator must approve conversion to an active member account.</div>`}
      <button class="button ghost block" style="margin-top:12px" data-action="browse-public">Browse public church information</button>
    </div></div>`;
  }

  function renderShell() {
    const active = isActiveMember();
    const pending = isPending();
    const navItems = [
      ['home', '⌂', 'Home'], ['events', '▣', 'Calendar'],
      ...(active ? [['inbox', '✉', 'Inbox'], ['teams', '♟', 'Teams']] : []),
      ['more', '☰', 'More']
    ];
    const subtitle = state.publicMode ? 'Public access' : `${currentUserName()} · ${roleLabel(state.profile?.role)}${pending ? ' pending approval' : ''}`;
    root.innerHTML = `<div class="app-shell">
      <header class="topbar">
        <div class="brand-mark" aria-hidden="true">✝</div>
        <div class="brand-copy"><h1 class="brand-title">${esc(church.name || 'Hillside Baptist Church')}</h1><div class="brand-subtitle">${esc(subtitle)}</div></div>
        ${isLeader() ? `<button class="icon-button" data-action="switch-tab" data-tab="admin" aria-label="Open management">◆</button>` : ''}
        ${isAuthenticated() ? `<button class="icon-button" data-action="logout" aria-label="Log out">↪</button>` : `<button class="icon-button" data-action="exit-public" aria-label="Log in">⇥</button>`}
      </header>
      <main class="main">${renderTab()}</main>
      <nav class="bottom-nav" style="--nav-count:${navItems.length}" aria-label="Main navigation">
        ${navItems.map(([tab, icon, label]) => `<button class="nav-button ${state.tab === tab ? 'active' : ''}" data-action="switch-tab" data-tab="${tab}"><span class="nav-icon">${icon}</span><span>${label}</span></button>`).join('')}
      </nav>
    </div>`;
  }

  function renderTab() {
    if (state.tab === 'home') return renderHome();
    if (state.tab === 'events') return renderEvents();
    if (state.tab === 'inbox' && isActiveMember()) return renderInbox();
    if (state.tab === 'teams' && isActiveMember()) return renderTeams();
    if (state.tab === 'admin' && isLeader()) return renderAdmin();
    return renderMore();
  }

  function renderHome() {
    const pendingCard = isPending() ? `<div class="card"><div class="meta">${badge('Approval pending', 'warning')}</div><h2 class="item-title" style="margin-top:9px">Your guest account is active</h2><p class="item-body">You can use public resources and submit private prayer requests. An administrator can convert this account to a member when appropriate.</p></div>` : '';
    return `${pageHead('Home', state.publicMode ? 'Public church information and resources' : `Welcome, ${currentUserName().split(' ')[0]}`,
      canCreateChurchContent() ? `<button class="button primary" data-action="announcement-new">＋ Announcement</button>` : '')}
      <div class="grid"><section class="card hero"><h2>${esc(church.tagline || '')}</h2><p>${esc(church.mission || '')}</p></section>${pendingCard}</div>
      <h2 class="section-title">Quick links</h2>
      <div class="grid two">
        ${quickLink('▣', 'Calendar', 'Services and upcoming events', 'switch-tab', 'events')}
        ${quickLink('▶', 'Messages and sermons', 'Watch recent church videos', 'external', church.messages)}
        ${quickLink('♡', 'Prayer request', 'Submit a request for prayer', 'more-view', 'prayer')}
        ${quickLink('$', 'Give online', 'Open the church giving page', 'external', church.give)}
      </div>
      <h2 class="section-title">Announcements</h2>
      <div class="grid">${state.data.announcements.length ? state.data.announcements.map(renderAnnouncement).join('') : empty('📣', 'No announcements', 'New announcements will appear here.')}</div>`;
  }

  function quickLink(icon, title, subtitle, action, value) {
    if (action === 'external') return `<a class="quick-link" href="${attr(value)}" target="_blank" rel="noopener noreferrer"><span class="quick-icon">${icon}</span><span class="quick-copy"><strong>${esc(title)}</strong><span>${esc(subtitle)}</span></span></a>`;
    const key = action === 'switch-tab' ? 'data-tab' : 'data-view';
    return `<button class="quick-link" data-action="${action}" ${key}="${attr(value)}"><span class="quick-icon">${icon}</span><span class="quick-copy"><strong>${esc(title)}</strong><span>${esc(subtitle)}</span></span></button>`;
  }

  function renderAnnouncement(item) {
    return `<article class="card"><div class="meta">${badge(audienceLabel(item))}<span>${fmtDate(item.created_at, true)}</span><span>by ${esc(nameById(item.author_id))}</span></div><h3 class="item-title" style="margin-top:8px">${esc(item.title)}</h3><p class="item-body">${nl(item.body)}</p>${canEditItem(item) ? `<div class="item-actions"><button class="button secondary small" data-action="announcement-edit" data-id="${item.id}">Edit</button><button class="button danger small" data-action="announcement-delete" data-id="${item.id}">Delete</button></div>` : ''}</article>`;
  }

  function renderEvents() {
    const events = [...state.data.events].sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
    return `${pageHead('Calendar', 'Public, church-wide, and team events', canCreateChurchContent() ? `<button class="button primary" data-action="event-new">＋ Event</button>` : '')}<div class="grid">${events.length ? events.map(renderEvent).join('') : empty('📅', 'No upcoming events', 'New events will appear here.')}</div>`;
  }

  function renderEvent(item) {
    return `<article class="card"><div class="meta">${badge(audienceLabel(item))}<span>${fmtDate(item.starts_at, true)}</span></div><h3 class="item-title" style="margin-top:8px">${esc(item.title)}</h3>${item.location ? `<div class="meta" style="margin-top:7px">● ${esc(item.location)}</div>` : ''}${item.description ? `<p class="item-body">${nl(item.description)}</p>` : ''}${canEditItem(item) ? `<div class="item-actions"><button class="button secondary small" data-action="event-edit" data-id="${item.id}">Edit</button><button class="button danger small" data-action="event-delete" data-id="${item.id}">Delete</button></div>` : ''}</article>`;
  }

  function renderInbox() {
    if (state.selectedConversation) return renderConversation();
    const conversations = conversationSummaries();
    return `${pageHead('Inbox', 'Private messages sent directly to you', `<button class="button primary" data-action="conversation-new">＋ Message</button>`)}
      <div class="grid">${conversations.length ? conversations.map((item) => `<button class="list-button" data-action="conversation-open" data-id="${item.id}">${avatar(item.otherName)}<span class="grow"><strong>${esc(item.otherName)}</strong><p>${esc(item.lastMessage || 'No messages')}</p></span><span class="meta">${item.lastAt ? fmtDate(item.lastAt, true) : ''} ›</span></button>`).join('') : empty('✉', 'No direct messages', 'Start a private conversation with an administrator or an eligible team member.')}</div>`;
  }

  function conversationSummaries() {
    return state.data.conversations.map((conversation) => {
      const members = state.data.conversationMembers.filter((m) => m.conversation_id === conversation.id);
      const other = members.find((m) => m.user_id !== id());
      const messages = state.data.messages.filter((m) => m.conversation_id === conversation.id).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      const last = messages[messages.length - 1];
      return { id: conversation.id, otherName: nameById(other?.user_id), lastMessage: last?.body, lastAt: last?.created_at };
    }).sort((a, b) => new Date(b.lastAt || 0) - new Date(a.lastAt || 0));
  }

  function renderConversation() {
    const conversationId = state.selectedConversation;
    const summary = conversationSummaries().find((c) => c.id === conversationId);
    const messages = state.data.messages.filter((m) => m.conversation_id === conversationId).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    return `<div class="back-row"><button data-action="conversation-back" aria-label="Back">‹</button><div><h1 class="page-title" style="font-size:22px">${esc(summary?.otherName || 'Conversation')}</h1><p class="page-subtitle">Private direct message</p></div></div>
      <section class="card"><div class="chat">${messages.map((message) => `<div class="bubble ${message.sender_id === id() ? 'mine' : ''}">${nl(message.body)}<small>${esc(nameById(message.sender_id))} · ${fmtDate(message.created_at, true)}</small></div>`).join('')}</div></section>
      <form class="chat-form" data-form="send-message"><textarea name="body" required maxlength="10000" placeholder="Write a message…" aria-label="Message"></textarea><button class="button primary" type="submit">Send</button></form>`;
  }

  function renderTeams() {
    if (state.selectedTeam) return renderSelectedTeam();
    const hidden = state.profile?.notification_preferences?.hidden_team_ids || [];
    const visibleTeams = state.data.teams.filter((team) => !hidden.includes(team.id));
    return `${pageHead('Teams', 'Your assigned ministry and service groups')}<div class="grid">${visibleTeams.length ? visibleTeams.map((team) => `<button class="list-button" data-action="team-open" data-id="${team.id}">${avatar(team.name)}<span class="grow"><strong>${esc(team.name)}</strong><p>${esc(team.description || 'Team messages and discussions')}</p></span><span>›</span></button>`).join('') : empty('♟', 'No visible teams', 'An administrator can assign you to a team. Hidden teams can be restored from Profile settings.')}</div>`;
  }

  function renderSelectedTeam() {
    if (state.selectedDiscussion) return renderDiscussionDetail();
    const team = teamById(state.selectedTeam);
    if (!team) { state.selectedTeam = null; return renderTeams(); }
    const notices = state.data.notices.filter((item) => item.team_id === team.id);
    const discussions = state.data.discussions.filter((item) => item.team_id === team.id);
    const manage = canManageTeam(team.id);
    return `<div class="back-row"><button data-action="team-back" aria-label="Back">‹</button><div><h1 class="page-title" style="font-size:22px">${esc(team.name)}</h1><p class="page-subtitle">${esc(team.description || '')}</p></div></div>
      <div class="tabs"><button class="tab-chip ${state.teamView === 'notices' ? 'active' : ''}" data-action="team-view" data-view="notices">Team messages</button><button class="tab-chip ${state.teamView === 'discussions' ? 'active' : ''}" data-action="team-view" data-view="discussions">Discussions</button></div>
      <div class="item-actions" style="margin:12px 0">${manage ? `<button class="button primary" data-action="${state.teamView === 'notices' ? 'notice-new' : 'discussion-new'}">＋ ${state.teamView === 'notices' ? 'Team message' : 'Discussion'}</button>` : ''}</div>
      <div class="grid">${state.teamView === 'notices' ? (notices.length ? notices.map(renderNotice).join('') : empty('📢', 'No team messages', 'Official notices from team leaders will appear here.')) : (discussions.length ? discussions.map(renderDiscussion).join('') : empty('💬', 'No discussions', 'Leaders can create a topic for the team to discuss.'))}</div>`;
  }

  function renderNotice(item) {
    return `<article class="card"><div class="meta">${badge('Official team message')}<span>${fmtDate(item.created_at, true)}</span></div><h3 class="item-title" style="margin-top:8px">${esc(item.title)}</h3>${item.meeting_at ? `<div class="notice" style="margin-top:9px"><strong>${fmtDate(item.meeting_at, true)}</strong>${item.location ? ` · ${esc(item.location)}` : ''}</div>` : ''}<p class="item-body">${nl(item.body)}</p>${canManageTeam(item.team_id) ? `<div class="item-actions"><button class="button secondary small" data-action="notice-edit" data-id="${item.id}">Edit</button><button class="button danger small" data-action="notice-delete" data-id="${item.id}">Delete</button></div>` : ''}</article>`;
  }

  function renderDiscussion(item) {
    const count = state.data.comments.filter((comment) => comment.discussion_id === item.id).length;
    return `<article class="card"><div class="meta">${badge('Discussion')}<span>${fmtDate(item.created_at, true)}</span><span>${count} comment${count === 1 ? '' : 's'}</span></div><h3 class="item-title" style="margin-top:8px">${esc(item.title)}</h3><p class="item-body">${nl(item.body)}</p><div class="item-actions"><button class="button ghost small" data-action="discussion-open" data-id="${item.id}">Open discussion</button>${canManageTeam(item.team_id) ? `<button class="button secondary small" data-action="discussion-edit" data-id="${item.id}">Edit</button><button class="button danger small" data-action="discussion-delete" data-id="${item.id}">Delete</button>` : ''}</div></article>`;
  }

  function renderDiscussionDetail() {
    const discussion = state.data.discussions.find((item) => item.id === state.selectedDiscussion);
    if (!discussion) { state.selectedDiscussion = null; return renderSelectedTeam(); }
    const comments = state.data.comments.filter((comment) => comment.discussion_id === discussion.id);
    return `<div class="back-row"><button data-action="discussion-back" aria-label="Back">‹</button><div><h1 class="page-title" style="font-size:22px">${esc(discussion.title)}</h1><p class="page-subtitle">${esc(teamName(discussion.team_id))} discussion</p></div></div>
      <article class="card"><p class="item-body" style="margin-top:0">${nl(discussion.body)}</p><div class="meta" style="margin-top:10px">Posted by ${esc(nameById(discussion.author_id))} · ${fmtDate(discussion.created_at, true)}</div></article>
      <h2 class="section-title">Comments</h2><div class="grid">${comments.length ? comments.map((comment) => `<article class="card compact"><div class="meta">${esc(nameById(comment.author_id))} · ${fmtDate(comment.created_at, true)}</div><p class="item-body">${nl(comment.body)}</p>${comment.author_id === id() || canManageTeam(discussion.team_id) ? `<div class="item-actions"><button class="button danger small" data-action="comment-delete" data-id="${comment.id}">Delete</button></div>` : ''}</article>`).join('') : empty('💬', 'No comments yet', 'Add the first response to this discussion.')}</div>
      <form class="form-grid card" data-form="comment-add" style="margin-top:12px"><div class="field"><label for="comment-body">Add a comment</label><textarea id="comment-body" name="body" required maxlength="5000"></textarea></div><button class="button primary" type="submit">Post comment</button></form>`;
  }

  function renderMore() {
    if (state.selectedDiscussion) return renderDiscussionDetail();
    if (state.moreView === 'church') return renderChurchInfo();
    if (state.moreView === 'prayer') return renderPrayer();
    if (state.moreView === 'directory' && isActiveMember()) return renderDirectory();
    if (state.moreView === 'profile' && isAuthenticated()) return renderProfile();
    return `${pageHead('More', 'Church resources and account settings')}<div class="grid">
      ${moreButton('✝', 'Church information', 'Mission, service times, ministries, and contact information', 'church')}
      ${moreButton('♡', 'Prayer requests', isActiveMember() ? 'Submit a request or view the member prayer wall' : 'Submit a private request to church leadership', 'prayer')}
      ${isActiveMember() ? moreButton('♟', 'Member directory', 'Contact information shared by church members', 'directory') : ''}
      ${isAuthenticated() ? moreButton('◉', 'Profile and preferences', 'Privacy, contact details, and notification settings', 'profile') : ''}
      <a class="list-button" href="${attr(church.messages)}" target="_blank" rel="noopener noreferrer"><span class="quick-icon">▶</span><span class="grow"><strong>Messages and sermons</strong><p>Open the church video and message page</p></span><span>↗</span></a>
      <a class="list-button" href="${attr(church.give)}" target="_blank" rel="noopener noreferrer"><span class="quick-icon">$</span><span class="grow"><strong>Give online</strong><p>Open the church giving page</p></span><span>↗</span></a>
    </div>`;
  }

  function moreButton(icon, title, description, view) {
    return `<button class="list-button" data-action="more-view" data-view="${view}"><span class="quick-icon">${icon}</span><span class="grow"><strong>${esc(title)}</strong><p>${esc(description)}</p></span><span>›</span></button>`;
  }

  function subBack(title, subtitle) {
    return `<div class="back-row"><button data-action="more-back" aria-label="Back">‹</button><div><h1 class="page-title" style="font-size:22px">${esc(title)}</h1>${subtitle ? `<p class="page-subtitle">${esc(subtitle)}</p>` : ''}</div></div>`;
  }

  function renderChurchInfo() {
    return `${subBack('Church information', church.name)}
      <div class="grid"><section class="card hero"><h2>${esc(church.tagline)}</h2><p>${esc(church.mission)}</p></section>
      <section class="card"><h2 class="item-title">Service times</h2><div class="grid" style="margin-top:10px">${(church.serviceTimes || []).map((service) => `<div class="card compact" style="box-shadow:none"><strong>${esc(service.day)} · ${esc(service.time)}</strong><div class="meta" style="margin-top:3px">${esc(service.name)}</div></div>`).join('')}</div></section>
      <section class="card"><h2 class="item-title">About Hillside</h2><p class="item-body">${esc(church.history)}</p><p class="item-body">${esc(church.belief)}</p></section>
      <section class="card"><h2 class="item-title">Ministries</h2>${(church.ministries || []).map((ministry) => `<h3 class="section-title" style="margin-bottom:3px">${esc(ministry.name)}</h3><p class="item-body" style="margin-top:0">${esc(ministry.description)}</p>`).join('')}</section>
      <section class="card"><h2 class="item-title">Contact</h2><p class="item-body">${esc(church.address)}<br>${esc(church.phoneDisplay)}<br>${esc(church.email)}</p><div class="item-actions"><a class="button primary" href="${attr(church.directions)}" target="_blank" rel="noopener noreferrer">Directions</a><a class="button secondary" href="tel:${attr(church.phone)}">Call</a><a class="button secondary" href="mailto:${attr(church.email)}">Email</a></div></section></div>`;
  }

  function renderPrayer() {
    const leadership = isLeader();
    const visible = state.data.prayers;
    return `${subBack('Prayer requests', isActiveMember() ? 'Member prayer wall and private submissions' : 'Private submission to church leadership')}
      <form class="card form-grid" data-form="prayer-submit">
        <div class="field"><label for="prayer-name">Name</label><input id="prayer-name" name="requester_name" maxlength="120" value="${attr(state.profile?.full_name || '')}" placeholder="Anonymous"></div>
        <div class="field"><label for="prayer-body">Prayer request</label><textarea id="prayer-body" name="body" required maxlength="10000"></textarea></div>
        ${isActiveMember() ? `<div class="field"><label for="prayer-visibility">Who may see this after approval?</label><select id="prayer-visibility" name="visibility"><option value="leadership">Church leadership only</option><option value="members">Member prayer wall</option></select></div>` : `<input type="hidden" name="visibility" value="leadership"><div class="notice">Guest and public requests are private and sent only to church leadership.</div>`}
        <button class="button primary" type="submit">Submit prayer request</button>
      </form>
      ${isAuthenticated() ? `<h2 class="section-title">${leadership ? 'Prayer moderation' : 'Prayer wall'}</h2><div class="grid">${visible.length ? visible.map(renderPrayerCard).join('') : empty('♡', 'No prayer requests', 'Approved member requests and your submissions will appear here.')}</div>` : ''}`;
  }

  function renderPrayerCard(item) {
    const statusType = item.status === 'approved' ? 'good' : item.status === 'pending' ? 'warning' : '';
    return `<article class="card"><div class="meta">${badge(item.status, statusType)}${badge(item.visibility === 'members' ? 'Member wall' : 'Leadership only')}<span>${fmtDate(item.created_at, true)}</span></div><h3 class="item-title" style="margin-top:8px">${esc(item.requester_name || 'Anonymous')}</h3><p class="item-body">${nl(item.body)}</p>${isLeader() ? `<div class="item-actions">${item.status !== 'approved' ? `<button class="button primary small" data-action="prayer-approve" data-id="${item.id}">Approve for members</button>` : ''}<button class="button secondary small" data-action="prayer-private" data-id="${item.id}">Leadership only</button><button class="button secondary small" data-action="prayer-archive" data-id="${item.id}">Archive</button><button class="button danger small" data-action="prayer-delete" data-id="${item.id}">Delete</button></div>` : ''}</article>`;
  }

  function renderDirectory() {
    const teams = Object.fromEntries(state.data.teams.map((team) => [team.id, team.name]));
    return `${subBack('Member directory', 'Only information authorized for your account is shown')}<div class="field" style="margin-bottom:12px"><label for="directory-search">Search</label><input id="directory-search" data-action="directory-search" placeholder="Search members"></div><div class="grid" id="directory-results">${renderDirectoryRows(state.data.directory, teams)}</div>`;
  }

  function renderDirectoryRows(list, teams) {
    return list.length ? list.map((person) => `<article class="card"><div class="admin-person-head">${avatar(person.full_name)}<div class="grow"><strong>${esc(person.full_name)}</strong><small>${esc(roleLabel(person.role))}</small></div></div><div class="item-body">${person.phone ? `<a href="tel:${attr(person.phone)}">${esc(person.phone)}</a><br>` : ''}${person.email ? `<a href="mailto:${attr(person.email)}">${esc(person.email)}</a><br>` : ''}${(person.team_ids || []).length ? `<span class="meta" style="margin-top:7px">${person.team_ids.map((teamId) => esc(teams[teamId] || '')).filter(Boolean).join(' · ')}</span>` : ''}${!person.phone && !person.email ? '<span class="meta">No contact information shared</span>' : ''}</div></article>`).join('') : empty('♟', 'No members found', 'Try a different search.') ;
  }

  function renderProfile() {
    const prefs = state.profile.notification_preferences || {};
    return `${subBack('Profile and preferences', 'Control directory visibility and dashboard activity')}
      <form class="card form-grid" data-form="profile-save">
        <div class="field"><label for="profile-name">Full name</label><input id="profile-name" name="full_name" required minlength="2" maxlength="120" value="${attr(state.profile.full_name)}"></div>
        <div class="notice"><strong>Private contact information</strong><br>Email: ${esc(state.privateProfile?.email || 'Not linked')}<br>Phone: ${esc(state.privateProfile?.phone || 'Not linked')}<br>Administrators can see complete contact information. Team leaders can see complete contact information for members of teams they lead.</div>
        <div><div class="check-row"><input id="show-email" type="checkbox" name="show_email" ${state.profile.show_email ? 'checked' : ''}><label for="show-email">Show my email in the member directory</label></div><div class="check-row"><input id="show-phone" type="checkbox" name="show_phone" ${state.profile.show_phone ? 'checked' : ''}><label for="show-phone">Show my phone number in the member directory</label></div></div>
        <h3 class="item-title">Notifications and home feed</h3>
        ${preferenceCheck('announcements', 'Announcements', prefs)}${preferenceCheck('events', 'Events', prefs)}${preferenceCheck('team_notices', 'Team messages', prefs)}${preferenceCheck('discussions', 'Discussion activity', prefs)}${preferenceCheck('prayer', 'Prayer activity', prefs)}
        ${isActiveMember() && state.data.teams.length ? `<h3 class="item-title">Hide teams from my main Teams screen</h3>${state.data.teams.map((team) => `<div class="check-row"><input id="hide-${team.id}" type="checkbox" name="hidden_team_ids" value="${team.id}" ${(prefs.hidden_team_ids || []).includes(team.id) ? 'checked' : ''}><label for="hide-${team.id}">${esc(team.name)}</label></div>`).join('')}` : ''}
        <button class="button primary" type="submit">Save profile</button>
      </form>
      <div class="card" style="margin-top:12px"><h3 class="item-title">Login methods</h3><p class="item-body">Add or change a verified email or phone number. Supabase sends a confirmation email or SMS code.</p><div class="item-actions"><button class="button secondary" data-action="email-change">Update email</button><button class="button secondary" data-action="phone-change">Update phone</button><button class="button secondary" data-action="password-change">Change password</button></div></div>`;
  }

  function preferenceCheck(name, label, prefs) {
    return `<div class="check-row"><input id="pref-${name}" type="checkbox" name="pref_${name}" ${prefs[name] !== false ? 'checked' : ''}><label for="pref-${name}">${esc(label)}</label></div>`;
  }

  function renderAdmin() {
    const pendingPrayers = state.data.prayers.filter((p) => p.status === 'pending');
    if (!isAdmin()) {
      return `${pageHead('Leader tools', 'Manage content, team communication, and prayer requests')}<div class="notice">Team assignments and account approvals require an administrator.</div><h2 class="section-title">Pending prayer requests</h2><div class="grid">${pendingPrayers.length ? pendingPrayers.map(renderPrayerCard).join('') : empty('♡', 'No pending requests', 'New requests for leadership review will appear here.')}</div>`;
    }
    const pendingPeople = state.data.adminPeople.filter((person) => person.status === 'pending' || person.role === 'guest');
    return `${pageHead('Administration', 'Account approval, roles, teams, and moderation')}
      <div class="grid two"><div class="card"><div class="meta">${badge(String(pendingPeople.length), pendingPeople.length ? 'warning' : 'good')}</div><h2 class="item-title" style="margin-top:8px">Pending guest accounts</h2><p class="item-body">Approve guest accounts and assign membership roles and teams.</p></div><div class="card"><div class="meta">${badge(String(pendingPrayers.length), pendingPrayers.length ? 'warning' : 'good')}</div><h2 class="item-title" style="margin-top:8px">Pending prayer requests</h2><p class="item-body">Review submissions before publishing them to the member prayer wall.</p></div></div>
      <h2 class="section-title">People</h2><div class="grid">${state.data.adminPeople.map(renderAdminPerson).join('')}</div>
      <h2 class="section-title">Prayer moderation</h2><div class="grid">${pendingPrayers.length ? pendingPrayers.map(renderPrayerCard).join('') : empty('♡', 'No pending requests', 'New requests will appear here.')}</div>`;
  }

  function renderAdminPerson(person) {
    const statusType = person.status === 'active' ? 'good' : person.status === 'deactivated' ? 'danger' : 'warning';
    return `<article class="card"><div class="admin-person-head">${avatar(person.full_name)}<div class="grow"><strong>${esc(person.full_name)}</strong><small>${esc(person.email || person.phone || 'No contact')}</small></div>${badge(roleLabel(person.role))}${badge(person.status, statusType)}</div><div class="meta" style="margin-top:10px">${(person.team_ids || []).map(teamName).join(' · ') || 'No teams assigned'}</div><div class="item-actions"><button class="button secondary small" data-action="admin-person-edit" data-id="${person.id}">Manage account</button>${person.status === 'pending' || person.role === 'guest' ? `<button class="button primary small" data-action="admin-approve" data-id="${person.id}">Approve as member</button>` : ''}</div></article>`;
  }

  function openModal(title, body, onSubmit) {
    modalRoot.innerHTML = `<div class="modal-backdrop" data-action="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><h2 id="modal-title">${esc(title)}</h2><button class="modal-close" data-action="modal-close" aria-label="Close">×</button></div>${body}</section></div>`;
    const form = modalRoot.querySelector('form');
    if (form && onSubmit) form.addEventListener('submit', async (event) => {
      event.preventDefault();
      setBusy(true);
      try { await onSubmit(new FormData(form), form); closeModal(); await refreshAll(true); render(); }
      catch (error) { handleError(error); }
      finally { setBusy(false); }
    });
    setTimeout(() => modalRoot.querySelector('input, textarea, select, button')?.focus(), 0);
  }
  function closeModal() { modalRoot.innerHTML = ''; }

  function audienceOptions(selected, itemTeam) {
    const options = [];
    if (isAdmin()) options.push(['public', 'Public / guests']);
    options.push(['members', 'Church members'], ['leaders', 'Leaders and admins']);
    if (state.data.teams.length) options.push(['team', 'Specific team']);
    return `<div class="field"><label for="item-audience">Audience</label><select id="item-audience" name="audience" data-action="audience-change">${options.map(([value, label]) => `<option value="${value}" ${selected === value ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></div><div class="field" id="team-field" style="${selected === 'team' ? '' : 'display:none'}"><label for="item-team">Team</label><select id="item-team" name="team_id">${state.data.teams.filter((team) => isAdmin() || canManageTeam(team.id)).map((team) => `<option value="${team.id}" ${itemTeam === team.id ? 'selected' : ''}>${esc(team.name)}</option>`).join('')}</select></div>`;
  }

  function announcementModal(item) {
    const record = item || { audience: isAdmin() ? 'public' : 'members', team_id: state.selectedTeam || '' };
    openModal(item ? 'Edit announcement' : 'New announcement', `<form class="form-grid"><div class="field"><label for="ann-title">Title</label><input id="ann-title" name="title" required maxlength="160" value="${attr(record.title || '')}"></div><div class="field"><label for="ann-body">Message</label><textarea id="ann-body" name="body" required maxlength="10000">${esc(record.body || '')}</textarea></div>${audienceOptions(record.audience, record.team_id)}<button class="button primary" type="submit">Save announcement</button></form>`, async (data) => {
      await state.api.saveAnnouncement({ id: record.id, author_id: record.author_id, title: data.get('title'), body: data.get('body'), audience: data.get('audience'), team_id: data.get('team_id') || null }, id());
      toast('Announcement saved.');
    });
  }

  function eventModal(item) {
    const record = item || { audience: isAdmin() ? 'public' : 'members', starts_at: new Date(Date.now() + 86400000).toISOString(), team_id: state.selectedTeam || '' };
    openModal(item ? 'Edit event' : 'New event', `<form class="form-grid"><div class="field"><label for="event-title">Title</label><input id="event-title" name="title" required maxlength="160" value="${attr(record.title || '')}"></div><div class="field"><label for="event-start">Starts</label><input id="event-start" name="starts_at" type="datetime-local" required value="${attr(toLocalInput(record.starts_at))}"></div><div class="field"><label for="event-end">Ends (optional)</label><input id="event-end" name="ends_at" type="datetime-local" value="${attr(toLocalInput(record.ends_at))}"></div><div class="field"><label for="event-location">Location</label><input id="event-location" name="location" maxlength="250" value="${attr(record.location || '')}"></div><div class="field"><label for="event-description">Description</label><textarea id="event-description" name="description" maxlength="10000">${esc(record.description || '')}</textarea></div>${audienceOptions(record.audience, record.team_id)}<button class="button primary" type="submit">Save event</button></form>`, async (data) => {
      await state.api.saveEvent({ id: record.id, author_id: record.author_id, title: data.get('title'), description: data.get('description'), starts_at: fromLocalInput(data.get('starts_at')), ends_at: fromLocalInput(data.get('ends_at')), location: data.get('location'), audience: data.get('audience'), team_id: data.get('team_id') || null }, id());
      toast('Event saved.');
    });
  }

  function noticeModal(item) {
    const record = item || { team_id: state.selectedTeam };
    openModal(item ? 'Edit team message' : 'New team message', `<form class="form-grid"><div class="field"><label for="notice-title">Title</label><input id="notice-title" name="title" required maxlength="160" value="${attr(record.title || '')}"></div><div class="field"><label for="notice-body">Official message</label><textarea id="notice-body" name="body" required maxlength="10000">${esc(record.body || '')}</textarea></div><div class="field"><label for="notice-date">Meeting date and time (optional)</label><input id="notice-date" name="meeting_at" type="datetime-local" value="${attr(toLocalInput(record.meeting_at))}"></div><div class="field"><label for="notice-location">Location</label><input id="notice-location" name="location" maxlength="250" value="${attr(record.location || '')}"></div><button class="button primary" type="submit">Save team message</button></form>`, async (data) => {
      await state.api.saveTeamNotice({ id: record.id, author_id: record.author_id, team_id: record.team_id, title: data.get('title'), body: data.get('body'), meeting_at: fromLocalInput(data.get('meeting_at')), location: data.get('location') }, id());
      toast('Team message saved.');
    });
  }

  function discussionModal(item) {
    const record = item || { team_id: state.selectedTeam };
    openModal(item ? 'Edit discussion' : 'New discussion', `<form class="form-grid"><div class="field"><label for="discussion-title">Topic</label><input id="discussion-title" name="title" required maxlength="160" value="${attr(record.title || '')}"></div><div class="field"><label for="discussion-body">Discussion prompt</label><textarea id="discussion-body" name="body" required maxlength="10000">${esc(record.body || '')}</textarea></div><button class="button primary" type="submit">Save discussion</button></form>`, async (data) => {
      await state.api.saveDiscussion({ id: record.id, author_id: record.author_id, team_id: record.team_id, title: data.get('title'), body: data.get('body') }, id());
      toast('Discussion saved.');
    });
  }

  function conversationModal() {
    openModal('New direct message', `<form class="form-grid"><div class="field"><label for="recipient">Recipient</label><select id="recipient" name="recipient" required><option value="">Choose a person</option>${state.data.recipients.map((person) => `<option value="${person.id}">${esc(person.full_name)} · ${esc(roleLabel(person.role))}</option>`).join('')}</select></div><div class="field"><label for="first-message">Message</label><textarea id="first-message" name="body" required maxlength="10000"></textarea></div><button class="button primary" type="submit">Send message</button></form>`, async (data) => {
      const conversationId = await state.api.startConversation(data.get('recipient'), data.get('body'));
      state.selectedConversation = conversationId;
      toast('Message sent.');
    });
  }

  function adminPersonModal(person) {
    const assigned = new Set(person.team_ids || []);
    openModal(`Manage ${person.full_name}`, `<form class="form-grid"><div class="notice">${esc(person.email || '')}${person.email && person.phone ? '<br>' : ''}${esc(person.phone || '')}</div><div class="field"><label for="person-role">Church role</label><select id="person-role" name="role">${['guest','member','leader','admin'].map((role) => `<option value="${role}" ${person.role === role ? 'selected' : ''}>${roleLabel(role)}</option>`).join('')}</select></div><div class="field"><label for="person-status">Account status</label><select id="person-status" name="status">${['pending','active','deactivated'].map((status) => `<option value="${status}" ${person.status === status ? 'selected' : ''}>${status}</option>`).join('')}</select></div><h3 class="item-title">Team assignments</h3>${state.data.teams.map((team) => `<div class="card compact"><div class="check-row"><input id="assign-${team.id}" type="checkbox" name="team_id" value="${team.id}" ${assigned.has(team.id) ? 'checked' : ''}><label for="assign-${team.id}">${esc(team.name)}</label></div><div class="field"><label for="team-role-${team.id}">Team role</label><select id="team-role-${team.id}" name="team_role_${team.id}">${['member','leader','read_only'].map((role) => `<option value="${role}" ${(person.team_roles || {})[team.id] === role ? 'selected' : ''}>${role.replace('_',' ')}</option>`).join('')}</select></div></div>`).join('')}<button class="button primary" type="submit">Save account</button></form>`, async (data) => {
      await state.api.adminUpdatePerson(person.id, { role: data.get('role'), status: data.get('status') });
      const memberships = data.getAll('team_id').map((teamId) => ({ team_id: teamId, team_role: data.get(`team_role_${teamId}`) || 'member' }));
      await state.api.adminSetTeamMemberships(person.id, memberships);
      toast('Account updated.');
    });
  }

  async function confirmDelete(message, callback) {
    openModal('Confirm deletion', `<div class="notice">${esc(message)}</div><div class="item-actions"><button class="button danger" data-action="confirm-delete">Delete</button><button class="button secondary" data-action="modal-close">Cancel</button></div>`);
    const button = modalRoot.querySelector('[data-action="confirm-delete"]');
    button.addEventListener('click', async () => {
      setBusy(true);
      try { await callback(); closeModal(); await refreshAll(true); render(); toast('Deleted.'); }
      catch (error) { handleError(error); }
      finally { setBusy(false); }
    });
  }

  root.addEventListener('click', async (event) => {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    try {
      if (action === 'auth-mode') { state.authMode = target.dataset.mode; render(); }
      else if (action === 'browse-public') { state.publicMode = true; state.tab = 'home'; await refreshPublic(true); render(); }
      else if (action === 'exit-public') { state.publicMode = false; render(); }
      else if (action === 'switch-tab') { state.tab = target.dataset.tab; if (state.tab !== 'more') state.moreView = 'menu'; if (state.tab !== 'teams') { state.selectedTeam = null; state.selectedDiscussion = null; } render(); }
      else if (action === 'logout') { await state.api.signOut(); toast('Signed out.'); }
      else if (action === 'forgot-password') { openPasswordReset(); }
      else if (action === 'more-view') { state.tab = 'more'; state.moreView = target.dataset.view; render(); }
      else if (action === 'more-back') { state.moreView = 'menu'; render(); }
      else if (action === 'announcement-new') announcementModal();
      else if (action === 'announcement-edit') announcementModal(state.data.announcements.find((x) => x.id === target.dataset.id));
      else if (action === 'announcement-delete') confirmDelete('Delete this announcement permanently?', () => state.api.deleteAnnouncement(target.dataset.id));
      else if (action === 'event-new') eventModal();
      else if (action === 'event-edit') eventModal(state.data.events.find((x) => x.id === target.dataset.id));
      else if (action === 'event-delete') confirmDelete('Delete this event permanently?', () => state.api.deleteEvent(target.dataset.id));
      else if (action === 'team-open') { state.selectedTeam = target.dataset.id; state.teamView = 'notices'; render(); }
      else if (action === 'team-back') { state.selectedTeam = null; state.selectedDiscussion = null; render(); }
      else if (action === 'team-view') { state.teamView = target.dataset.view; render(); }
      else if (action === 'notice-new') noticeModal();
      else if (action === 'notice-edit') noticeModal(state.data.notices.find((x) => x.id === target.dataset.id));
      else if (action === 'notice-delete') confirmDelete('Delete this team message permanently?', () => state.api.deleteTeamNotice(target.dataset.id));
      else if (action === 'discussion-new') discussionModal();
      else if (action === 'discussion-edit') discussionModal(state.data.discussions.find((x) => x.id === target.dataset.id));
      else if (action === 'discussion-delete') confirmDelete('Delete this discussion and its comments?', () => state.api.deleteDiscussion(target.dataset.id));
      else if (action === 'discussion-open') { state.selectedDiscussion = target.dataset.id; render(); }
      else if (action === 'discussion-back') { state.selectedDiscussion = null; render(); }
      else if (action === 'comment-delete') confirmDelete('Delete this comment?', () => state.api.deleteDiscussionComment(target.dataset.id));
      else if (action === 'conversation-new') conversationModal();
      else if (action === 'conversation-open') { state.selectedConversation = target.dataset.id; render(); setTimeout(() => document.querySelector('.chat')?.scrollTo(0, 999999), 0); }
      else if (action === 'conversation-back') { state.selectedConversation = null; render(); }
      else if (action === 'prayer-approve') { await state.api.updatePrayer(target.dataset.id, { status: 'approved', visibility: 'members', reviewed_by: id(), reviewed_at: new Date().toISOString() }); await refreshAll(true); render(); toast('Prayer request approved for members.'); }
      else if (action === 'prayer-private') { await state.api.updatePrayer(target.dataset.id, { status: 'approved', visibility: 'leadership', reviewed_by: id(), reviewed_at: new Date().toISOString() }); await refreshAll(true); render(); toast('Prayer request kept private.'); }
      else if (action === 'prayer-archive') { await state.api.updatePrayer(target.dataset.id, { status: 'archived', reviewed_by: id(), reviewed_at: new Date().toISOString() }); await refreshAll(true); render(); }
      else if (action === 'prayer-delete') confirmDelete('Delete this prayer request permanently?', () => state.api.deletePrayer(target.dataset.id));
      else if (action === 'admin-person-edit') adminPersonModal(state.data.adminPeople.find((x) => x.id === target.dataset.id));
      else if (action === 'admin-approve') { await state.api.adminUpdatePerson(target.dataset.id, { role: 'member', status: 'active' }); await refreshAll(true); render(); toast('Guest account approved as a member.'); }
      else if (action === 'email-change') openEmailChange();
      else if (action === 'phone-change') openPhoneChange();
      else if (action === 'password-change') openPasswordChange();
    } catch (error) { handleError(error); }
  });

  root.addEventListener('input', (event) => {
    if (event.target.dataset.action === 'directory-search') {
      const query = event.target.value.trim().toLowerCase();
      const list = state.data.directory.filter((person) => person.full_name.toLowerCase().includes(query) || String(person.email || '').toLowerCase().includes(query) || String(person.phone || '').includes(query));
      const teams = Object.fromEntries(state.data.teams.map((team) => [team.id, team.name]));
      document.getElementById('directory-results').innerHTML = renderDirectoryRows(list, teams);
    }
  });

  root.addEventListener('submit', async (event) => {
    const form = event.target.closest('form[data-form]');
    if (!form) return;
    event.preventDefault();
    setBusy(true);
    const data = new FormData(form);
    try {
      if (form.dataset.form === 'auth-login') {
        await state.api.signIn(data.get('identifier'), data.get('password'));
        toast('Signed in.');
      } else if (form.dataset.form === 'auth-signup') {
        const identifier = String(data.get('identifier') || '').trim();
        const result = await state.api.signUp(data.get('name'), identifier, data.get('password'));
        if (demoMode || result.session) {
          toast('Guest account created and awaiting administrator approval.');
        } else if (!identifier.includes('@')) {
          const phone = state.api.normalizePhone(identifier);
          openModal('Verify mobile phone', `<form class="form-grid"><div class="notice">Enter the SMS code sent to ${esc(phone)} to finish creating the guest account.</div><div class="field"><label for="signup-phone-code">Verification code</label><input id="signup-phone-code" name="token" inputmode="numeric" autocomplete="one-time-code" required minlength="6" maxlength="8"></div><button class="button primary" type="submit">Verify account</button></form>`, async (otpData) => {
            await state.api.verifyPhoneSignup(phone, otpData.get('token'));
            toast('Phone verified. Your guest account is awaiting administrator approval.');
          });
        } else {
          toast('Account created. Check your email to confirm signup.');
        }
      } else if (form.dataset.form === 'send-message') {
        await state.api.sendMessage(state.selectedConversation, data.get('body'), id());
        form.reset(); await refreshAll(true); render(); setTimeout(() => document.querySelector('.chat')?.scrollTo(0, 999999), 0);
      } else if (form.dataset.form === 'comment-add') {
        await state.api.addDiscussionComment(state.selectedDiscussion, data.get('body'), id());
        form.reset(); await refreshAll(true); render();
      } else if (form.dataset.form === 'prayer-submit') {
        await state.api.submitPrayer({ requester_name: data.get('requester_name'), body: data.get('body'), visibility: data.get('visibility') }, id());
        form.reset(); await refreshAll(true); render(); toast('Prayer request submitted for leadership review.');
      } else if (form.dataset.form === 'profile-save') {
        const prefs = {
          announcements: data.has('pref_announcements'), events: data.has('pref_events'), team_notices: data.has('pref_team_notices'),
          discussions: data.has('pref_discussions'), prayer: data.has('pref_prayer'), hidden_team_ids: data.getAll('hidden_team_ids')
        };
        state.profile = await state.api.updateProfile(id(), { full_name: data.get('full_name').trim(), show_email: data.has('show_email'), show_phone: data.has('show_phone'), notification_preferences: prefs });
        await refreshAll(true); render(); toast('Profile saved.');
      }
    } catch (error) { handleError(error); }
    finally { setBusy(false); }
  });

  modalRoot.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    if (target.dataset.action === 'modal-close' || (target.dataset.action === 'modal-backdrop' && event.target === target)) closeModal();
  });

  modalRoot.addEventListener('change', (event) => {
    const target = event.target.closest('[data-action="audience-change"]');
    if (!target) return;
    const field = modalRoot.querySelector('#team-field');
    if (field) field.style.display = target.value === 'team' ? '' : 'none';
  });

  function openPasswordReset() {
    openModal('Reset password', `<form class="form-grid"><div class="field"><label for="reset-email">Email address</label><input id="reset-email" name="email" type="email" required autocomplete="email"></div><div class="help">Password reset by phone is not included in this release. Phone-only users should contact an administrator.</div><button class="button primary" type="submit">Send reset email</button></form>`, async (data) => { await state.api.resetPassword(data.get('email')); toast('Password reset email sent.'); });
  }
  function openEmailChange() {
    openModal('Update email', `<form class="form-grid"><div class="field"><label for="new-email">New email address</label><input id="new-email" name="email" type="email" required autocomplete="email"></div><div class="notice">Supabase will send confirmation instructions. The address will not change until verification is completed.</div><button class="button primary" type="submit">Send confirmation</button></form>`, async (data) => { await state.api.updateEmail(data.get('email')); toast('Email confirmation sent.'); });
  }
  function openPhoneChange() {
    openModal('Update phone', `<form class="form-grid"><div class="field"><label for="new-phone">Mobile phone</label><input id="new-phone" name="phone" type="tel" required autocomplete="tel" placeholder="(405) 555-0123"></div><button class="button primary" type="submit">Send SMS code</button></form>`, async (data) => {
      const phone = await state.api.updatePhone(data.get('phone'));
      closeModal();
      openModal('Verify phone', `<form class="form-grid"><div class="notice">Enter the SMS code sent to ${esc(phone)}.</div><div class="field"><label for="phone-code">Verification code</label><input id="phone-code" name="token" inputmode="numeric" required minlength="6" maxlength="8"></div><button class="button primary" type="submit">Verify phone</button></form>`, async (otpData) => { await state.api.verifyPhoneChange(phone, otpData.get('token')); state.privateProfile = await state.api.getOwnPrivateProfile(id()); toast('Phone number verified.'); });
    });
  }
  function openPasswordChange() {
    openModal('Change password', `<form class="form-grid"><div class="field"><label for="new-password">New password</label><input id="new-password" name="password" type="password" required minlength="8" autocomplete="new-password"></div><button class="button primary" type="submit">Update password</button></form>`, async (data) => { await state.api.updatePassword(data.get('password')); toast('Password updated.'); });
  }

  window.addEventListener('popstate', () => {
    if (state.selectedDiscussion) state.selectedDiscussion = null;
    else if (state.selectedConversation) state.selectedConversation = null;
    else if (state.selectedTeam) state.selectedTeam = null;
    else if (state.moreView !== 'menu') state.moreView = 'menu';
    else state.tab = 'home';
    render();
  });

  initialize();
})();
