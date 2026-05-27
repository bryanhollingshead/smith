// Smith — Profile page
// Renders ProfileHeader + Featured + Companies + Credentials + RightRail.
// Used for both /profile (own) and /profile/:id (anyone). Fetches the profile
// and (for the right rail) a small slice of connections.

import React, { useEffect, useState, useCallback } from 'react';
import { B } from '../lib/theme.js';
import { TopNav } from '../components/TopNav.jsx';
import {
  ProfileHeader, AboutSection, CompaniesSection, FeaturedSection,
  CredentialsSection, ProfileRightRail, ProfileStrengthBanner,
} from '../components/ProfileSections.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { useRouter } from '../lib/router.jsx';

export function ProfilePage({ userId }) {
  const { user } = useAuth();
  const { navigate } = useRouter();
  const [profile, setProfile] = useState(null);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isMe = !userId || userId === user?.id || String(userId) === String(user?.id);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const path = isMe ? '/profiles/me' : `/profiles/${userId}`;
      const { profile } = await api.get(path);
      setProfile(profile);
      // Right rail data (only relevant for self).
      if (isMe) {
        const { connections } = await api.get('/connections');
        setConnections(connections);
      } else {
        setConnections([]);
      }
    } catch (e) {
      setError(e.data?.error || e.message || 'Could not load profile');
    } finally {
      setLoading(false);
    }
  }, [isMe, userId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ background: B.bg, minHeight: '100vh' }}>
      <TopNav active="profile"/>
      <main style={{ maxWidth: 1180, margin: '0 auto', padding: '32px 40px' }}>
        {loading && <Skeleton/>}
        {error && (
          <div style={{
            background: B.surface, border: `1px solid ${B.danger}`, borderRadius: 4,
            padding: '24px', color: B.danger,
          }}>{error}</div>
        )}
        {profile && (
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'flex-start',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <ProfileHeader
                profile={profile}
                isMe={isMe}
                onEdit={() => navigate('/profile/edit')}
                onConnect={() => load()}
              />
              <AboutSection profile={profile} isMe={isMe} onEdit={() => navigate('/profile/edit')}/>
              {isMe && <ProfileStrengthBanner onEdit={() => navigate('/profile/edit')}/>}
              <FeaturedSection profile={profile} isMe={isMe} navigate={navigate} onEdit={() => navigate('/profile/edit')}/>
              <CompaniesSection profile={profile} isMe={isMe} onEdit={() => navigate('/profile/edit')}/>
              <CredentialsSection profile={profile} isMe={isMe} onEdit={() => navigate('/profile/edit')}/>
            </div>
            <ProfileRightRail
              profile={profile}
              isMe={isMe}
              recentConnections={connections}
              onEdit={() => navigate('/profile/edit')}
            />
          </div>
        )}
      </main>
    </div>
  );
}

function Skeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[260, 320, 400, 240].map((h, i) => (
          <div key={i} style={{
            height: h, background: B.surface, border: `1px solid ${B.line}`,
            borderRadius: 4, opacity: 0.6,
          }}/>
        ))}
      </div>
      <div style={{
        height: 300, background: B.surface, border: `1px solid ${B.line}`,
        borderRadius: 4, opacity: 0.6,
      }}/>
    </div>
  );
}
