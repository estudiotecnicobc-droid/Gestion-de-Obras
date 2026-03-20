import { supabase } from './supabaseClient';
import { OrgRole } from '../types';

export interface Invitation {
  id: string;
  organizationId: string;
  organizationName?: string;
  invitedEmail?: string;
  role: OrgRole;
  token: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string;
}

function mapRow(r: Record<string, any>): Invitation {
  return {
    id: r.id,
    organizationId: r.organization_id,
    organizationName: r.organization_name ?? undefined,
    invitedEmail: r.invited_email ?? undefined,
    role: r.role as OrgRole,
    token: r.token,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    acceptedAt: r.accepted_at ?? undefined,
  };
}

export const invitationsService = {
  async create(orgId: string, role: OrgRole, email?: string): Promise<Invitation> {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('invitations')
      .insert({
        organization_id: orgId,
        role,
        invited_email: email ?? null,
        created_by: user?.id,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return mapRow(data);
  },

  async listForOrg(orgId: string): Promise<Invitation[]> {
    const { data, error } = await supabase
      .from('invitations')
      .select('*')
      .eq('organization_id', orgId)
      .is('accepted_at', null)
      .order('created_at', { ascending: false });
    if (error) return [];
    return (data ?? []).map(mapRow);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('invitations').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async accept(token: string): Promise<{ ok: boolean; organizationId?: string; error?: string }> {
    const { data, error } = await supabase.rpc('accept_invitation', { p_token: token });
    if (error) return { ok: false, error: error.message };
    if (data?.error) return { ok: false, error: data.error };
    return { ok: true, organizationId: data.organization_id };
  },

  async getByToken(token: string): Promise<Invitation | null> {
    const { data } = await supabase.rpc('get_invitation_by_token', { p_token: token });
    return data ? mapRow(data) : null;
  },
};
