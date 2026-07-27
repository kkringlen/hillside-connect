(function () {
  'use strict';

  function normalizePhone(value, countryCode) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (raw.startsWith('+')) return '+' + raw.slice(1).replace(/\D/g, '');
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 10 && countryCode === '+1') return '+1' + digits;
    return countryCode + digits;
  }

  function assertConfigured(config) {
    return Boolean(
      config &&
      /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(config.SUPABASE_URL || '') &&
      config.SUPABASE_PUBLISHABLE_KEY &&
      !String(config.SUPABASE_PUBLISHABLE_KEY).includes('YOUR_KEY')
    );
  }

  function createSupabaseApi(config) {
    if (!window.supabase || !window.supabase.createClient) {
      throw new Error('The Supabase browser library did not load. Check your network connection and content security settings.');
    }

    const client = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      },
      realtime: { params: { eventsPerSecond: 10 } }
    });

    function fail(error, fallback) {
      if (!error) return;
      const message = error.message || fallback || 'Supabase request failed.';
      const wrapped = new Error(message);
      wrapped.cause = error;
      throw wrapped;
    }

    async function rows(query, fallback) {
      const { data, error } = await query;
      fail(error, fallback);
      return data || [];
    }

    async function one(query, fallback, allowNull) {
      const { data, error } = await query;
      if (allowNull && error && error.code === 'PGRST116') return null;
      fail(error, fallback);
      return data || null;
    }

    async function signIn(identifier, password) {
      const login = String(identifier || '').trim();
      const credentials = login.includes('@')
        ? { email: login.toLowerCase(), password }
        : { phone: normalizePhone(login, config.DEFAULT_COUNTRY_CODE || '+1'), password };
      const { data, error } = await client.auth.signInWithPassword(credentials);
      fail(error, 'Unable to sign in.');
      return data;
    }

    async function signUp(fullName, identifier, password) {
      const login = String(identifier || '').trim();
      const options = { data: { full_name: String(fullName || '').trim() } };
      if (location.origin.startsWith('http')) options.emailRedirectTo = location.origin + location.pathname;
      const credentials = login.includes('@')
        ? { email: login.toLowerCase(), password, options }
        : { phone: normalizePhone(login, config.DEFAULT_COUNTRY_CODE || '+1'), password, options: { ...options, channel: 'sms' } };
      const { data, error } = await client.auth.signUp(credentials);
      fail(error, 'Unable to create the account.');
      return data;
    }

    return {
      kind: 'supabase',
      client,
      isConfigured: () => assertConfigured(config),
      normalizePhone: (value) => normalizePhone(value, config.DEFAULT_COUNTRY_CODE || '+1'),

      async getSession() {
        const { data, error } = await client.auth.getSession();
        fail(error, 'Unable to restore the session.');
        return data.session || null;
      },

      onAuthStateChange(callback) {
        const { data } = client.auth.onAuthStateChange((_event, session) => callback(session));
        return () => data.subscription.unsubscribe();
      },

      signIn,
      signUp,

      async signOut() {
        const { error } = await client.auth.signOut();
        fail(error, 'Unable to sign out.');
      },

      async resetPassword(email) {
        const redirectTo = location.origin + location.pathname;
        const { error } = await client.auth.resetPasswordForEmail(String(email || '').trim().toLowerCase(), { redirectTo });
        fail(error, 'Unable to send the password reset email.');
      },

      async updatePassword(password) {
        const { error } = await client.auth.updateUser({ password });
        fail(error, 'Unable to update the password.');
      },

      async updateEmail(email) {
        const { error } = await client.auth.updateUser({ email: String(email || '').trim().toLowerCase() });
        fail(error, 'Unable to start the email update.');
      },

      async updatePhone(phone) {
        const normalized = normalizePhone(phone, config.DEFAULT_COUNTRY_CODE || '+1');
        const { error } = await client.auth.updateUser({ phone: normalized });
        fail(error, 'Unable to start phone verification.');
        return normalized;
      },

      async verifyPhoneChange(phone, token) {
        const { error } = await client.auth.verifyOtp({
          phone: normalizePhone(phone, config.DEFAULT_COUNTRY_CODE || '+1'),
          token: String(token || '').trim(),
          type: 'phone_change'
        });
        fail(error, 'The phone verification code was not accepted.');
      },

      async verifyPhoneSignup(phone, token) {
        const { data, error } = await client.auth.verifyOtp({
          phone: normalizePhone(phone, config.DEFAULT_COUNTRY_CODE || '+1'),
          token: String(token || '').trim(),
          type: 'sms'
        });
        fail(error, 'The signup verification code was not accepted.');
        return data;
      },

      async getProfile(userId) {
        return one(client.from('profiles').select('*').eq('id', userId).single(), 'Unable to load your profile.', true);
      },

      async getOwnPrivateProfile(userId) {
        return one(client.from('private_profiles').select('email,phone').eq('user_id', userId).single(), 'Unable to load private contact information.', true);
      },

      async listProfiles() {
        return rows(client.from('profiles').select('id,full_name,role,status,directory_email,directory_phone').order('full_name'), 'Unable to load profile names.');
      },

      async listAnnouncements() {
        return rows(client.from('announcements').select('*').order('created_at', { ascending: false }), 'Unable to load announcements.');
      },

      async saveAnnouncement(record, userId) {
        const payload = {
          title: record.title.trim(), body: record.body.trim(), audience: record.audience,
          team_id: record.audience === 'team' ? record.team_id : null,
          author_id: record.author_id || userId
        };
        if (record.id) {
          return one(client.from('announcements').update(payload).eq('id', record.id).select().single(), 'Unable to update the announcement.');
        }
        return one(client.from('announcements').insert(payload).select().single(), 'Unable to create the announcement.');
      },

      async deleteAnnouncement(id) {
        const { error } = await client.from('announcements').delete().eq('id', id);
        fail(error, 'Unable to delete the announcement.');
      },

      async listEvents() {
        return rows(client.from('events').select('*').order('starts_at', { ascending: true }), 'Unable to load events.');
      },

      async saveEvent(record, userId) {
        const payload = {
          title: record.title.trim(), description: record.description.trim(), starts_at: record.starts_at,
          ends_at: record.ends_at || null, location: record.location.trim(), audience: record.audience,
          team_id: record.audience === 'team' ? record.team_id : null, author_id: record.author_id || userId
        };
        if (record.id) return one(client.from('events').update(payload).eq('id', record.id).select().single(), 'Unable to update the event.');
        return one(client.from('events').insert(payload).select().single(), 'Unable to create the event.');
      },

      async deleteEvent(id) {
        const { error } = await client.from('events').delete().eq('id', id);
        fail(error, 'Unable to delete the event.');
      },

      async listTeams() {
        return rows(client.from('teams').select('*').eq('active', true).order('name'), 'Unable to load teams.');
      },

      async listTeamMemberships() {
        return rows(client.from('team_members').select('*'), 'Unable to load team membership.');
      },

      async listTeamNotices() {
        return rows(client.from('team_notices').select('*').order('created_at', { ascending: false }), 'Unable to load team messages.');
      },

      async saveTeamNotice(record, userId) {
        const payload = {
          team_id: record.team_id, author_id: record.author_id || userId, title: record.title.trim(), body: record.body.trim(),
          meeting_at: record.meeting_at || null, location: record.location.trim()
        };
        if (record.id) return one(client.from('team_notices').update(payload).eq('id', record.id).select().single(), 'Unable to update the team message.');
        return one(client.from('team_notices').insert(payload).select().single(), 'Unable to create the team message.');
      },

      async deleteTeamNotice(id) {
        const { error } = await client.from('team_notices').delete().eq('id', id);
        fail(error, 'Unable to delete the team message.');
      },

      async listTeamDiscussions() {
        return rows(client.from('team_discussions').select('*').order('created_at', { ascending: false }), 'Unable to load discussions.');
      },

      async saveDiscussion(record, userId) {
        const payload = { team_id: record.team_id, author_id: record.author_id || userId, title: record.title.trim(), body: record.body.trim() };
        if (record.id) return one(client.from('team_discussions').update(payload).eq('id', record.id).select().single(), 'Unable to update the discussion.');
        return one(client.from('team_discussions').insert(payload).select().single(), 'Unable to create the discussion.');
      },

      async deleteDiscussion(id) {
        const { error } = await client.from('team_discussions').delete().eq('id', id);
        fail(error, 'Unable to delete the discussion.');
      },

      async listDiscussionComments() {
        return rows(client.from('team_discussion_comments').select('*').order('created_at', { ascending: true }), 'Unable to load discussion comments.');
      },

      async addDiscussionComment(discussionId, body, userId) {
        return one(client.from('team_discussion_comments').insert({ discussion_id: discussionId, body: body.trim(), author_id: userId }).select().single(), 'Unable to add the comment.');
      },

      async deleteDiscussionComment(id) {
        const { error } = await client.from('team_discussion_comments').delete().eq('id', id);
        fail(error, 'Unable to delete the comment.');
      },

      async listPrayers() {
        return rows(client.from('prayer_requests').select('*').order('created_at', { ascending: false }), 'Unable to load prayer requests.');
      },

      async submitPrayer(record, userId) {
        const payload = {
          requester_id: userId || null,
          requester_name: record.requester_name.trim() || 'Anonymous',
          body: record.body.trim(), visibility: record.visibility || 'leadership', status: 'pending'
        };
        const { error } = await client.from('prayer_requests').insert(payload);
        fail(error, 'Unable to submit the prayer request.');
        return payload;
      },

      async updatePrayer(id, changes) {
        return one(client.from('prayer_requests').update(changes).eq('id', id).select().single(), 'Unable to update the prayer request.');
      },

      async deletePrayer(id) {
        const { error } = await client.from('prayer_requests').delete().eq('id', id);
        fail(error, 'Unable to delete the prayer request.');
      },

      async listDirectory() {
        const { data, error } = await client.rpc('get_member_directory');
        fail(error, 'Unable to load the member directory.');
        return data || [];
      },

      async listDirectRecipients() {
        const { data, error } = await client.rpc('get_direct_recipients');
        fail(error, 'Unable to load message recipients.');
        return data || [];
      },

      async listConversations() {
        const conversations = await rows(client.from('direct_conversations').select('*').order('created_at', { ascending: false }), 'Unable to load conversations.');
        if (!conversations.length) return { conversations: [], members: [], messages: [] };
        const ids = conversations.map((item) => item.id);
        const [members, messages] = await Promise.all([
          rows(client.from('direct_conversation_members').select('*').in('conversation_id', ids), 'Unable to load conversation members.'),
          rows(client.from('direct_messages').select('*').in('conversation_id', ids).order('created_at', { ascending: true }), 'Unable to load messages.')
        ]);
        return { conversations, members, messages };
      },

      async startConversation(targetUser, body) {
        const { data, error } = await client.rpc('start_direct_conversation', { target_user: targetUser, initial_message: body.trim() });
        fail(error, 'Unable to start the conversation.');
        return data;
      },

      async sendMessage(conversationId, body, userId) {
        return one(client.from('direct_messages').insert({ conversation_id: conversationId, sender_id: userId, body: body.trim() }).select().single(), 'Unable to send the message.');
      },

      async updateProfile(userId, changes) {
        return one(client.from('profiles').update(changes).eq('id', userId).select().single(), 'Unable to update the profile.');
      },

      async listAdminPeople() {
        const { data, error } = await client.rpc('get_admin_people');
        fail(error, 'Unable to load administrative account data.');
        return data || [];
      },

      async adminUpdatePerson(userId, changes) {
        return one(client.from('profiles').update(changes).eq('id', userId).select().single(), 'Unable to update the account.');
      },

      async adminSetTeamMemberships(userId, memberships) {
        const { error } = await client.rpc('admin_set_team_memberships', { target_user: userId, memberships });
        fail(error, 'Unable to update team assignments.');
      },

      subscribe(callback) {
        const channel = client.channel('hillside-connect-live');
        ['announcements', 'events', 'prayer_requests', 'direct_messages', 'team_notices', 'team_discussions', 'team_discussion_comments'].forEach((table) => {
          channel.on('postgres_changes', { event: '*', schema: 'public', table }, callback);
        });
        channel.subscribe();
        return () => client.removeChannel(channel);
      }
    };
  }

  window.HillsideSupabase = { createSupabaseApi, assertConfigured };
})();
