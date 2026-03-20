import React, { useState, useEffect } from 'react';
import { Building2, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { invitationsService, Invitation } from '../services/invitationsService';
import { useAuth } from '../context/AuthContext';

const ROLE_LABELS: Record<string, string> = {
  owner:  'Propietario',
  admin:  'Administrador',
  editor: 'Editor',
  viewer: 'Observador',
};

interface Props {
  token: string;
  onComplete: (organizationId: string) => void;
  onSkip: () => void;
}

export const InvitationAccept: React.FC<Props> = ({ token, onComplete, onSkip }) => {
  const { reloadUserData, setActiveOrganization } = useAuth();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    invitationsService
      .getByToken(token)
      .then(setInvitation)
      .catch(() => setError('No se pudo cargar la invitación.'))
      .finally(() => setLoadingInvite(false));
  }, [token]);

  const handleAccept = async () => {
    setAccepting(true);
    setError(null);
    const result = await invitationsService.accept(token);
    if (!result.ok) {
      setError(result.error ?? 'Error al aceptar la invitación.');
      setAccepting(false);
      return;
    }
    await reloadUserData();
    if (result.organizationId) {
      setActiveOrganization(result.organizationId);
    }
    onComplete(result.organizationId ?? '');
  };

  // ── Loading state ────────────────────────────────────────────────────────────

  if (loadingInvite) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-slate-400 text-sm">Verificando invitación…</p>
        </div>
      </div>
    );
  }

  // ── Invitación no encontrada / expirada ──────────────────────────────────────

  if (!invitation) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
          <XCircle className="w-14 h-14 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Invitación inválida</h2>
          <p className="text-slate-500 text-sm mb-6">
            Este link de invitación no existe, ya fue utilizado o ha expirado.
          </p>
          <button
            onClick={onSkip}
            className="w-full py-2.5 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors"
          >
            Continuar sin unirse
          </button>
        </div>
      </div>
    );
  }

  const orgName = invitation.organizationName || 'la organización';
  const roleLabel = ROLE_LABELS[invitation.role] ?? invitation.role;

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Invitación a organización</h2>
        </div>

        <div className="bg-slate-50 rounded-xl p-4 mb-6 text-center">
          <p className="text-slate-500 text-sm mb-1">Fuiste invitado a unirte a</p>
          <p className="text-xl font-bold text-slate-800 mb-1">{orgName}</p>
          <p className="text-xs text-slate-500">como <span className="font-semibold">{roleLabel}</span></p>
          {invitation.invitedEmail && (
            <p className="text-xs text-slate-400 mt-1">({invitation.invitedEmail})</p>
          )}
        </div>

        {error && (
          <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onSkip}
            disabled={accepting}
            className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            Ignorar
          </button>
          <button
            onClick={handleAccept}
            disabled={accepting}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {accepting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Aceptando…
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Aceptar invitación
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
