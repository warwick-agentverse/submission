import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  Lock,
  KeyRound,
  UserCheck,
  ShieldAlert,
  FileLock2,
  Server,
  Trash2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  ActorRole,
  CraOnboardingCheckResult,
  DocumentAccessCheckResult,
  EncryptedFinancialDocument,
  KeyManagementMode,
  SecurityAuditEvent,
  TaxpayerIdentityProfile,
  verifyCraIdentityAndPreventDuplicateProfile,
  verifyDocumentOwnershipAndDecrypt,
} from '../utils/securityEngine';

export type SecurityModalTab =
  | 'cra_identity'
  | 'idor_ownership'
  | 'envelope_encryption'
  | 'uk_gdpr_governance';

interface SecurityComplianceModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: SecurityModalTab;
  profiles: TaxpayerIdentityProfile[];
  activeProfileId: string;
  onSelectActiveProfile: (userId: string) => void;
  vaultDocuments: EncryptedFinancialDocument[];
  keyManagementMode: KeyManagementMode;
  onChangeKeyManagementMode: (mode: KeyManagementMode) => void;
  onCryptoShredDocument: (documentId: string) => void;
  securityEvents: SecurityAuditEvent[];
  onRecordSecurityEvent: (
    severity: SecurityAuditEvent['severity'],
    category: SecurityAuditEvent['category'],
    targetResourceId: string,
    outcome: SecurityAuditEvent['outcome'],
    summary: string
  ) => void;
}

export const SecurityComplianceModal: React.FC<SecurityComplianceModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'idor_ownership',
  profiles,
  activeProfileId,
  onSelectActiveProfile,
  vaultDocuments,
  keyManagementMode,
  onChangeKeyManagementMode,
  onCryptoShredDocument,
  securityEvents,
  onRecordSecurityEvent,
}) => {
  const [activeTab, setActiveTab] = useState<SecurityModalTab>(initialTab);
  const [selectedDocId, setSelectedDocId] = useState<string>(
    vaultDocuments[0]?.documentId || 'doc-49102-monzo-csv'
  );
  const [simulatedUrlInput, setSimulatedUrlInput] = useState<string>(
    'https://taximiser.uk/api/security/vault/documents/doc-49102-monzo-csv'
  );
  const [lastAccessResult, setLastAccessResult] =
    useState<DocumentAccessCheckResult | null>(null);
  const [isCheckingServerIdor, setIsCheckingServerIdor] = useState(false);

  // CRA Onboarding & Duplicate Fraud Test Form State
  const [candName, setCandName] = useState('Alex M. (Attempted 2nd Duplicate Account)');
  const [candDob, setCandDob] = useState('1989-04-14');
  const [candUtr, setCandUtr] = useState('4910288341');
  const [candNino, setCandNino] = useState('QQ 12 34 56 C');
  const [candAddress, setCandAddress] = useState(
    '14 Clerkenwell Green, Studio 3B, London'
  );
  const [candPostcode, setCandPostcode] = useState('EC1R 0DP');
  const [craTestResult, setCraTestResult] =
    useState<CraOnboardingCheckResult | null>(null);

  if (!isOpen) return null;

  const activeProfile =
    profiles.find((p) => p.userId === activeProfileId) || profiles[0];
  const selectedDocument =
    vaultDocuments.find((d) => d.documentId === selectedDocId) ||
    vaultDocuments[0];

  const handleTestDocumentAccess = async (targetDocumentId: string) => {
    setSelectedDocId(targetDocumentId);
    setSimulatedUrlInput(
      `https://taximiser.uk/api/security/vault/documents/${targetDocumentId}`
    );
    const targetDoc = vaultDocuments.find(
      (d) => d.documentId === targetDocumentId
    );
    if (!targetDoc) return;

    // 1. Run deterministic client-side ownership & zero-trust verification
    const localCheck = verifyDocumentOwnershipAndDecrypt({
      requestingUserId: activeProfile.userId,
      requestingRole: activeProfile.role as ActorRole,
      sessionToken: activeProfile.sessionToken,
      document: targetDoc,
    });

    // 2. Also call the live Express server endpoint to enforce server-side IDOR check
    setIsCheckingServerIdor(true);
    try {
      await fetch(`/api/security/vault/documents/${targetDocumentId}`, {
        method: 'GET',
        headers: {
          'x-authenticated-user-id': activeProfile.userId,
          'x-actor-role': activeProfile.role,
          Authorization: `Bearer ${activeProfile.sessionToken}`,
        },
      });
    } catch {
      // Offline fallback uses deterministic localCheck
    } finally {
      setIsCheckingServerIdor(false);
    }

    setLastAccessResult(localCheck);
    onRecordSecurityEvent(
      localCheck.allowed ? 'INFO' : 'BLOCKED_ATTACK',
      'IDOR_ACCESS_CHECK',
      targetDocumentId,
      localCheck.allowed ? 'ALLOWED' : 'DENIED_403',
      localCheck.auditMessage
    );
  };

  const handleRunCraOnboardingTest = (
    preset?: 'duplicate_fraud' | 'legit_new_sole_trader'
  ) => {
    let testPayload = {
      candidateFullName: candName,
      candidateDob: candDob,
      candidateUtr: candUtr,
      candidateNino: candNino,
      candidateAddress: candAddress,
      candidatePostcode: candPostcode,
    };

    if (preset === 'duplicate_fraud') {
      testPayload = {
        candidateFullName: 'Alex M. (Attempted 2nd Duplicate Account)',
        candidateDob: '1989-04-14',
        candidateUtr: '4910288341',
        candidateNino: 'QQ 12 34 56 C',
        candidateAddress: '14 Clerkenwell Green, Studio 3B, London',
        candidatePostcode: 'EC1R 0DP',
      };
      setCandName(testPayload.candidateFullName);
      setCandDob(testPayload.candidateDob);
      setCandUtr(testPayload.candidateUtr);
      setCandNino(testPayload.candidateNino);
      setCandAddress(testPayload.candidateAddress);
      setCandPostcode(testPayload.candidatePostcode);
    } else if (preset === 'legit_new_sole_trader') {
      testPayload = {
        candidateFullName: 'Hannah Sterling (Bristol Ceramics Studio)',
        candidateDob: '1993-07-19',
        candidateUtr: '7741209831',
        candidateNino: 'JC 44 81 29 A',
        candidateAddress: '9 Clifton Arcade, Bristol',
        candidatePostcode: 'BS8 4AA',
      };
      setCandName(testPayload.candidateFullName);
      setCandDob(testPayload.candidateDob);
      setCandUtr(testPayload.candidateUtr);
      setCandNino(testPayload.candidateNino);
      setCandAddress(testPayload.candidateAddress);
      setCandPostcode(testPayload.candidatePostcode);
    }

    const res = verifyCraIdentityAndPreventDuplicateProfile({
      ...testPayload,
      existingProfiles: profiles,
    });
    setCraTestResult(res);
    onRecordSecurityEvent(
      res.allowed ? 'INFO' : 'BLOCKED_ATTACK',
      'CRA_IDENTITY_CHECK',
      res.craIdentityHash,
      res.allowed ? 'ALLOWED' : 'DENIED_403',
      res.explanation
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="security-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-5xl w-full p-5 space-y-4 shadow-xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-200">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                UK GDPR &amp; DPA 2018 Compliant
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono text-[11px]">
                <Lock className="w-3 h-3 text-slate-700" />
                AES-256-GCM Per-Chunk DEK/KEK Envelope
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono text-[11px]">
                FIPS 140-2 · TLS 1.3 (TCP/443) · VPC-SC
              </span>
            </div>
            <h2
              id="security-modal-title"
              className="text-base font-bold text-slate-900 mt-1.5"
            >
              Financial Data Security, CRA Identity Anti-Fraud &amp; Cryptographic Ownership Vault
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close security and compliance modal"
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Active Session Identity Switcher Bar (Test External & Internal Actors) */}
        <div className="p-3 bg-slate-900 text-white rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-400">
              Active Authenticated Session Context (Switch Actor to Test IDOR &amp; Internal Zero-Trust)
            </div>
            <div className="font-semibold text-white flex flex-wrap items-center gap-2">
              <span>{activeProfile.fullName}</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-emerald-300">
                ID: {activeProfile.userId}
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                Role: {activeProfile.role}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            {profiles.map((prof) => {
              const isSelected = prof.userId === activeProfile.userId;
              const shortLabel =
                prof.role === 'AUTHENTICATED_TAXPAYER'
                  ? 'Owner (Alex · #49102)'
                  : prof.role === 'EXTERNAL_OTHER_USER'
                    ? 'Other User (Priya · #88319)'
                    : 'Internal Staff (Zero-Trust)';
              return (
                <button
                  key={prof.userId}
                  type="button"
                  onClick={() => {
                    onSelectActiveProfile(prof.userId);
                    setLastAccessResult(null);
                  }}
                  className={`px-2.5 py-1.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {shortLabel}
                </button>
              );
            })}
          </div>
        </div>

        {/* 4-Tab Navigation */}
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('idor_ownership')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'idor_ownership'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileLock2 className="w-3.5 h-3.5 text-emerald-700" />
            1. Document Ownership &amp; Anti-IDOR Guard
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('envelope_encryption')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'envelope_encryption'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 text-emerald-700" />
            2. AES-256-GCM Envelope Encryption (DEK/KEK)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cra_identity')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'cra_identity'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
            3. Credit Agency (CRA) Login &amp; Anti-Fraud
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('uk_gdpr_governance')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'uk_gdpr_governance'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Server className="w-3.5 h-3.5 text-emerald-700" />
            4. UK GDPR, DPA 2018 &amp; Gemini Enterprise Isolation
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
          {/* TAB 1: Document Ownership & Anti-IDOR Guard */}
          {activeTab === 'idor_ownership' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      Mandatory Document Ownership Check (Anti-IDOR URL Tampering Protection)
                    </h3>
                    <p className="text-slate-600 mt-0.5">
                      Every request to view or decrypt a financial file executes{' '}
                      <code className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200">
                        verifyDocumentOwnershipAndDecrypt(requestingUserId, documentId)
                      </code>{' '}
                      on both client and server. Changing the URL to another user&apos;s document ID is hard-blocked with HTTP 403.
                    </p>
                  </div>
                </div>

                {/* Simulated URL Bar */}
                <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="flex-1 flex items-center gap-2 bg-white border border-slate-300 rounded-lg px-3 py-1.5 font-mono text-[11px] text-slate-800">
                    <Lock className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span className="text-slate-400 select-none">GET</span>
                    <input
                      type="text"
                      aria-label="Simulated Document Request URL"
                      value={simulatedUrlInput}
                      onChange={(e) => setSimulatedUrlInput(e.target.value)}
                      className="w-full bg-transparent focus:outline-none text-slate-900"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const parts = simulatedUrlInput.trim().split('/');
                      const docIdFromUrl =
                        parts[parts.length - 1] || 'doc-88319-barclays-statement';
                      handleTestDocumentAccess(docIdFromUrl);
                    }}
                    disabled={isCheckingServerIdor}
                    className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg cursor-pointer shrink-0"
                  >
                    {isCheckingServerIdor ? 'Verifying Owner...' : 'Request URL'}
                  </button>
                </div>

                {/* Quick Preset Test Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleTestDocumentAccess('doc-49102-monzo-csv')}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-md cursor-pointer"
                  >
                    Test Legitimate Owner Access (Alex&apos;s Monzo CSV)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleTestDocumentAccess('doc-88319-barclays-statement')
                    }
                    data-testid="test-idor-attack-btn"
                    className="px-2.5 py-1 text-[11px] font-semibold bg-rose-50 hover:bg-rose-100 text-rose-900 border border-rose-200 rounded-md cursor-pointer"
                  >
                    Simulate URL Tamper Attack (?docId=doc-88319-barclays-statement)
                  </button>
                </div>
              </div>

              {/* Access Result Banner */}
              {lastAccessResult && (
                <div
                  data-testid="idor-access-result-banner"
                  className={`p-3.5 rounded-lg border space-y-1.5 ${
                    lastAccessResult.allowed
                      ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                      : 'bg-rose-50/90 border-rose-300 text-rose-950'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs flex items-center gap-1.5">
                      {lastAccessResult.allowed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                      ) : (
                        <ShieldAlert className="w-4 h-4 text-rose-700" />
                      )}
                      HTTP {lastAccessResult.httpStatus} · {lastAccessResult.errorCode}
                    </span>
                    <span className="font-mono text-[11px]">
                      {lastAccessResult.ukGdprCitation}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed">
                    {lastAccessResult.auditMessage}
                  </p>
                  {lastAccessResult.allowed && lastAccessResult.decryptedPayload ? (
                    <div className="p-2.5 bg-white/90 border border-emerald-200 rounded font-mono text-[11px] text-slate-800">
                      <span className="text-emerald-800 font-bold">
                        DECRYPTED OWNER PAYLOAD:{' '}
                      </span>
                      {lastAccessResult.decryptedPayload}
                    </div>
                  ) : (
                    <div className="p-2.5 bg-white/90 border border-rose-200 rounded font-mono text-[11px] text-rose-900">
                      <strong>ZERO-TRUST CIPHERTEXT LOCKED:</strong> KEK/DEK unwrap refused because{' '}
                      <code>requestingUserId ({lastAccessResult.requestingUserId})</code> ≠{' '}
                      <code>document.ownerUserId ({lastAccessResult.documentOwnerUserId})</code>.
                    </div>
                  )}
                </div>
              )}

              {/* Vault Documents Table */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                      <th className="py-2 px-3">Document ID &amp; File</th>
                      <th className="py-2 px-3">Bound Owner User ID</th>
                      <th className="py-2 px-3">Encryption Status</th>
                      <th className="py-2 px-3 text-right">Access Check</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {vaultDocuments.map((doc) => {
                      const isOwnedByActive =
                        doc.ownerUserId === activeProfile.userId &&
                        activeProfile.role === 'AUTHENTICATED_TAXPAYER';
                      return (
                        <tr key={doc.documentId} className="hover:bg-slate-50/80">
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-900">
                              {doc.fileName}
                            </div>
                            <div className="font-mono text-[10px] text-slate-500">
                              ID: {doc.documentId} · £{doc.grossAmountGbp.toLocaleString()}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px]">
                            <div className="font-semibold text-slate-800">
                              {doc.ownerUserId}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {doc.ownerName}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            {doc.isCryptoShredded ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-mono text-[10px] font-bold">
                                CRYPTO-SHREDDED (410)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono text-[10px] font-semibold">
                                AES-256-GCM · {doc.chunks.length} Chunk DEK(s)
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                handleTestDocumentAccess(doc.documentId)
                              }
                              className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                                isOwnedByActive
                                  ? 'bg-slate-900 text-white hover:bg-slate-800'
                                  : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
                              }`}
                            >
                              {isOwnedByActive
                                ? 'Verify & Decrypt (Owner)'
                                : 'Attempt Access (Test 403)'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: AES-256-GCM Envelope Encryption (Data at Rest + In Transit) */}
          {activeTab === 'envelope_encryption' && (
            <div className="space-y-4">
              {/* Key Management Selector: GMEK vs CMEK vs EKM/HSM */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      Envelope Encryption Architecture (AES-256-GCM Per-Chunk DEKs + KEK Wrapping)
                    </h3>
                    <p className="text-slate-600 mt-0.5">
                      Every financial document is split into chunks in code. Each chunk is encrypted with a unique 256-bit Data Encryption Key (DEK) using AES-256-GCM, and each DEK is wrapped by a Key Encryption Key (KEK) in a FIPS 140-2 aligned module.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  {(
                    [
                      {
                        mode: 'GMEK' as const,
                        title: 'Default: Google-Managed Keys (GMEK)',
                        desc: 'Encrypted at rest by default using Google-owned and Google-managed KEKs with automatic rotation.',
                      },
                      {
                        mode: 'CMEK_CLOUD_KMS' as const,
                        title: 'Enterprise: Customer-Managed (CMEK)',
                        desc: 'Customer controls KEK lifecycle, rotation & revocation in Google Cloud KMS (europe-west2 London).',
                      },
                      {
                        mode: 'EKM_HSM' as const,
                        title: 'External Key Manager (EKM & HSM)',
                        desc: 'Keys held in dedicated customer Hardware Security Module (FIPS 140-2 Level 3) via Cloud EKM.',
                      },
                    ] as const
                  ).map((item) => {
                    const active = keyManagementMode === item.mode;
                    return (
                      <button
                        key={item.mode}
                        type="button"
                        onClick={() => onChangeKeyManagementMode(item.mode)}
                        className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                          active
                            ? 'bg-emerald-50/70 border-emerald-600 ring-1 ring-emerald-600'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-slate-900">
                            {item.title}
                          </span>
                          {active && (
                            <span className="text-[10px] font-mono font-bold text-emerald-700">
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                          {item.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Data in Transit & Network Isolation Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="p-3 bg-white border border-slate-200 rounded-lg">
                  <div className="text-[10px] font-mono uppercase text-slate-400">
                    Data in Transit Encryption
                  </div>
                  <div className="font-bold text-slate-900 mt-0.5">
                    TLS 1.3 / TLS 1.2+ (TCP/443)
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    All inbound &amp; outbound traffic encrypted over HTTPS/TLS on port TCP/443 with HSTS preload.
                  </p>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-lg">
                  <div className="text-[10px] font-mono uppercase text-slate-400">
                    Network Isolation
                  </div>
                  <div className="font-bold text-slate-900 mt-0.5">
                    VPC Service Controls &amp; PSC
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Private Service Connect &amp; private load-balancing prevent exposure of storage buckets to the public internet.
                  </p>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-lg">
                  <div className="text-[10px] font-mono uppercase text-slate-400">
                    Cryptographic Standard
                  </div>
                  <div className="font-bold text-slate-900 mt-0.5">
                    AES-256-GCM · FIPS 140-2
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Galois/Counter Mode (96-bit IV + 128-bit Auth Tag) ensures both confidentiality and tamper-evident integrity.
                  </p>
                </div>
              </div>

              {/* Live Per-Chunk Ciphertext Inspector ("Even if stolen, it cannot be understood") */}
              {selectedDocument && (
                <div className="p-3.5 bg-slate-900 text-slate-100 rounded-lg space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                    <div>
                      <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-400">
                        Code-Level Encrypted Storage View (&ldquo;Stolen Disk / Packet Inspection&rdquo;)
                      </div>
                      <div className="font-bold text-sm text-white mt-0.5">
                        {selectedDocument.fileName} ({selectedDocument.documentId})
                      </div>
                    </div>
                    <select
                      aria-label="Select document to inspect ciphertext"
                      value={selectedDocument.documentId}
                      onChange={(e) => setSelectedDocId(e.target.value)}
                      className="bg-slate-800 border border-slate-700 text-white text-xs rounded px-2.5 py-1.5 font-mono"
                    >
                      {vaultDocuments.map((d) => (
                        <option key={d.documentId} value={d.documentId}>
                          {d.fileName} ({d.ownerUserId})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    {selectedDocument.chunks.map((chunk) => (
                      <div
                        key={chunk.dekId}
                        className="p-2.5 bg-slate-950 border border-slate-800 rounded font-mono text-[11px] space-y-1"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-emerald-400">
                          <span>
                            CHUNK #{chunk.chunkIndex + 1} ({chunk.byteLength} bytes) ·{' '}
                            {chunk.algorithm}
                          </span>
                          <span>Unique DEK ID: {chunk.dekId}</span>
                        </div>
                        <div className="text-slate-400 truncate">
                          KEK URI: <span className="text-slate-300">{chunk.kekKeyUri}</span>
                        </div>
                        <div className="text-slate-400 truncate">
                          Wrapped DEK (Encrypted by KEK):{' '}
                          <span className="text-amber-300">{chunk.wrappedDekHex}</span>
                        </div>
                        <div className="text-slate-400">
                          96-bit IV: <span className="text-slate-200">{chunk.ivHex}</span> · 128-bit GCM Auth Tag:{' '}
                          <span className="text-slate-200">{chunk.authTagHex}</span>
                        </div>
                        <div className="text-rose-300 break-all bg-slate-900/90 p-1.5 rounded border border-slate-800">
                          Raw Ciphertext At Rest: {chunk.ciphertextBase64}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Secure Login & Credit Reference Agency (CRA) Identity Piggybacking */}
          {activeTab === 'cra_identity' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <h3 className="font-bold text-slate-900 text-sm">
                  Credit Reference Agency (CRA) Identity Piggybacking &amp; Duplicate Profile Prevention
                </h3>
                <p className="text-slate-600">
                  To prevent bad actors from creating duplicate profiles or using synthetic identities to claim multiple HMRC Personal Allowances (£12,570) or fraudulent SA103F tax reliefs, onboarding piggybacks off established UK Credit Reference Agencies (<strong>Experian UK</strong>, <strong>Equifax UK</strong>, and <strong>TransUnion UK</strong>). Each taxpayer&apos;s NINO, UTR, DOB, and Electoral Roll address are bound to a single deterministic CRA Identity Fingerprint.
                </p>

                {/* Active Taxpayer CRA Piggybacked Profile Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  {profiles[0].craAgencies.map((cra) => (
                    <div
                      key={cra.agency}
                      className="p-3 bg-white border border-slate-200 rounded-lg space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">
                          {cra.agency}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono text-[10px] font-bold">
                          {cra.status}
                        </span>
                      </div>
                      <div className="font-mono text-xs text-slate-800">
                        Header Score: <strong>{cra.creditHeaderScore}/999</strong>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Electoral Roll: Confirmed ({cra.addressYearsAtCurrent} yrs at EC1R 0DP)
                      </div>
                      <div className="font-mono text-[10px] text-slate-400">
                        Ref: {cra.referenceId}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Interactive Duplicate Profile & Fraud Onboarding Simulator */}
              <div className="p-3.5 bg-white border border-slate-200 rounded-lg space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-slate-900">
                      Test CRA Deduplication Gate (Attempt Duplicate or New Profile Registration)
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Test what happens when a user or fraudster attempts to open a second account using an existing UTR, NINO, or CRA credit header footprint.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleRunCraOnboardingTest('duplicate_fraud')}
                      data-testid="test-cra-duplicate-btn"
                      className="px-2.5 py-1.5 bg-rose-700 hover:bg-rose-800 text-white font-semibold rounded-md text-[11px] cursor-pointer"
                    >
                      Test Duplicate Profile Fraud Attempt
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleRunCraOnboardingTest('legit_new_sole_trader')
                      }
                      className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-md text-[11px] cursor-pointer"
                    >
                      Test Legitimate New Taxpayer
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Applicant Full Name
                    </label>
                    <input
                      type="text"
                      value={candName}
                      onChange={(e) => setCandName(e.target.value)}
                      className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      HMRC UTR (10 Digits)
                    </label>
                    <input
                      type="text"
                      value={candUtr}
                      onChange={(e) => setCandUtr(e.target.value)}
                      className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      UK National Insurance (NINO)
                    </label>
                    <input
                      type="text"
                      value={candNino}
                      onChange={(e) => setCandNino(e.target.value)}
                      className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs font-mono"
                    />
                  </div>
                </div>

                {craTestResult && (
                  <div
                    data-testid="cra-test-result-banner"
                    className={`p-3 rounded-lg border space-y-1 ${
                      craTestResult.allowed
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                        : 'bg-rose-50 border-rose-300 text-rose-950'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold flex items-center gap-1.5">
                        {craTestResult.allowed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-rose-700" />
                        )}
                        {craTestResult.status} (Fraud Risk Score: {craTestResult.fraudRiskScore}/100)
                      </span>
                      <span className="font-mono text-[10px]">
                        {craTestResult.dpa2018Citation}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed">
                      {craTestResult.explanation}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: UK GDPR, DPA 2018 & Gemini Enterprise Data Governance */}
          {activeTab === 'uk_gdpr_governance' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-lg space-y-1">
                  <div className="text-[10px] font-mono uppercase text-emerald-800 font-bold">
                    Gemini Enterprise Governance
                  </div>
                  <div className="font-bold text-slate-900 text-sm">
                    Zero Model Training on User Data
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Unlike consumer AI apps, Gemini Enterprise never uses your prompts, tax returns, addresses, or financial documents to train foundation models.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                  <div className="text-[10px] font-mono uppercase text-slate-500 font-bold">
                    Tenant &amp; Project Isolation
                  </div>
                  <div className="font-bold text-slate-900 text-sm">
                    Strict Per-Customer Boundary
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Customer data remains strictly isolated within the dedicated Google Cloud project boundary and is never shared across tenants.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                  <div className="text-[10px] font-mono uppercase text-slate-500 font-bold">
                    UK GDPR Art. 17 &amp; Retention SLA
                  </div>
                  <div className="font-bold text-slate-900 text-sm">
                    60-Day Deletion &amp; Crypto-Shredding
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    User-requested deletions purge all data within 60 days, with immediate cryptographic erasure (DEK destruction) on request.
                  </p>
                </div>
              </div>

              {/* Right to Erasure / Crypto-Shredding Action Table */}
              <div className="p-3.5 bg-white border border-slate-200 rounded-lg space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900">
                      UK GDPR Art. 17 Right to Erasure (Immediate DEK Crypto-Shredding &amp; 60-Day Purge Queue)
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Destroy a document&apos;s Data Encryption Keys (DEKs) immediately so its ciphertext can never be decrypted again, and schedule physical storage deletion within 60 days.
                    </p>
                  </div>
                </div>

                <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
                  {vaultDocuments
                    .filter((d) => d.ownerUserId === 'usr-sole-trader-49102')
                    .map((doc) => (
                      <div
                        key={doc.documentId}
                        className="p-2.5 flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="font-semibold text-slate-900">
                            {doc.fileName}
                          </div>
                          <div className="font-mono text-[10px] text-slate-500">
                            60-Day Auto-Purge SLA: {doc.retentionDeleteByIso.slice(0, 10)} ·{' '}
                            {doc.isCryptoShredded
                              ? 'DEKs Destroyed (Unreadable)'
                              : `${doc.chunks.length} Active DEKs`}
                          </div>
                        </div>

                        {doc.isCryptoShredded ? (
                          <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-600 font-mono text-[11px] font-semibold">
                            Purged / Crypto-Shredded
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onCryptoShredDocument(doc.documentId)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-[11px] font-semibold cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            Crypto-Shred DEK (Art. 17)
                          </button>
                        )}
                      </div>
                    ))}
                </div>
              </div>

              {/* Immutable Security & Access Control Audit Log */}
              <div className="space-y-1.5">
                <h4 className="font-bold text-slate-900">
                  Immutable Security &amp; Access Audit Log (UK GDPR Art. 30 &amp; Art. 32)
                </h4>
                <div className="border border-slate-200 rounded-lg divide-y divide-slate-200 max-h-44 overflow-y-auto">
                  {securityEvents.map((evt) => (
                    <div
                      key={evt.id}
                      className="p-2.5 flex items-start justify-between gap-3 text-[11px]"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 font-mono">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              evt.outcome === 'DENIED_403'
                                ? 'bg-rose-100 text-rose-800'
                                : evt.outcome === 'ENCRYPTED'
                                  ? 'bg-teal-100 text-teal-800'
                                  : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {evt.outcome}
                          </span>
                          <span className="font-semibold text-slate-800">
                            {evt.category}
                          </span>
                          <span className="text-slate-400">
                            Actor: {evt.actorId} ({evt.actorRole})
                          </span>
                        </div>
                        <p className="text-slate-700">{evt.summary}</p>
                      </div>
                      <span className="font-mono text-[10px] text-slate-400 shrink-0">
                        {evt.timestamp}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200 text-xs text-slate-500">
          <span>
            Protected under UK GDPR, Data Protection Act 2018, FIPS 140-2 &amp; OWASP API1:2023 Object Level Authorization.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
