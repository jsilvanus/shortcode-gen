# Privacy and Security Assessment

**Assessment date:** 2026-08-26  
**Repository:** `jsilvanus/shortcode-gen`  
**Assessment type:** internal engineering self-assessment

## 1. Important scope statement

This document is an engineering assessment of the current repository. It is **not**:

- an ISO certification;
- an accredited conformity assessment;
- an independent security audit;
- a penetration test;
- a legal opinion on GDPR compliance;
- a Data Protection Impact Assessment (DPIA).

The purpose is to make security/privacy work visible and provide a structured basis for future remediation.

## 2. Standards considered

### ISO/IEC 27001:2022

ISO/IEC 27001:2022 specifies requirements for an information security management system (ISMS), including information-security risk assessment and treatment. This project uses the standard as a reference point for engineering controls, but it does not operate a certified ISMS and does not claim conformity.

### ISO/IEC 27701:2025

ISO/IEC 27701:2025 is the current international standard for Privacy Information Management Systems (PIMS). It addresses organisations responsible for processing personally identifiable information as controllers and processors.

The project uses it as a privacy-management reference. It does not claim ISO/IEC 27701 certification or conformity.

## 3. GDPR-oriented assessment

The software contains technical measures relevant to GDPR principles, but GDPR compliance is deployment-specific. The operator determines the purposes and means of processing, legal basis, notices, retention, processor relationships and data-subject procedures.

### Data minimisation — partial/positive

The schema avoids raw IP-address storage in the visit model and uses pseudonymization for audit actors. API keys are hashed. However, visitor hashes, screenshots, target URLs and metadata can still contain personal data.

### Purpose limitation — partial

Technical purposes are identifiable, but the operator must document its actual processing purposes, especially analytics and audit logging.

### Storage limitation — partial

Link expiry exists, but complete retention/deletion schedules for analytics, audit records, screenshots, jobs and other records are not yet formalized.

### Integrity/confidentiality — positive/partial

Authentication, password hashing, server-side sessions, domain membership and hashed API keys provide substantial technical controls. Infrastructure hardening and operational security remain deployment responsibilities.

### Accountability — positive/partial

Audit logging exists and is intentionally pseudonymized. A full organizational accountability system, including policies, review cadence and evidence management, is not yet established in the repository.

### Privacy by design/default — positive/partial

Several design decisions support privacy, particularly domain isolation, minimised credential storage and audit pseudonymization. A complete privacy-by-design process and documented review gate for new features is still missing.

## 4. ISO/IEC 27001-oriented control areas

| Area | Current position | Gap |
|---|---|---|
| Information-security policy/governance | Partial | No full ISMS/policy set in repository |
| Risk management | Partial | Security risks identified, formal risk register still needed |
| Asset/information inventory | Partial | Data inventory created; operational asset inventory needed |
| Access control | Implemented/partial | Strong application foundation; needs complete route regression testing |
| Cryptography/secrets | Implemented/partial | Password/API-key hashing; deployment secret controls require verification |
| Secure development | Partial | Tests/CI exist; formal secure-development process not documented |
| Vulnerability management | Partial | Dependency review and independent testing still needed |
| Logging/monitoring | Implemented/partial | Audit/logging exists; operational monitoring policy needs definition |
| Backup/recovery | External/partial | PostgreSQL project owns backups; restore test needs evidence |
| Incident management | Planned | Procedure not yet documented |
| Business continuity | Partial | Application rollback concept exists; full continuity plan absent |
| Supplier/third-party management | Partial | Deployment-specific provider inventory required |

## 5. ISO/IEC 27701-oriented control areas

| Area | Current position | Gap |
|---|---|---|
| PII inventory | Implemented/partial | Data inventory created; deployment-specific inventory required |
| Processing purposes | Partial | Operator must document actual purposes |
| Controller/processor roles | Deployment-specific | Cannot be determined from software alone |
| Data minimisation | Positive/partial | Analytics/screenshots need continued review |
| Retention | Partial | Explicit retention schedules needed |
| Deletion | Partial | Database cascades exist; files/backups require lifecycle handling |
| Data-subject rights | Planned | No complete automated workflow |
| Privacy risk management | Partial | This assessment begins the process; formal PIMS absent |
| Privacy incident management | Planned | Needs procedure |
| Privacy governance | Planned | Requires organizational policies beyond the codebase |

## 6. Current strengths

- Domain-aware authorization is structurally represented.
- Passwords are hashed with Argon2.
- Sessions are server-side.
- API keys are stored as hashes rather than reusable secrets.
- Audit entries avoid raw user IDs.
- Per-user audit salts enable crypto-shredding of historical identity linkage.
- Database-backed jobs provide durable asynchronous work.
- SSRF protection is treated as a dedicated security concern.
- Production/staging deployment architecture is explicitly separated.
- Database backups are delegated to dedicated PostgreSQL infrastructure rather than being hidden inside the application.

## 7. Current gaps

1. No independent security audit or penetration test.
2. No formal ISO/IEC 27001 certification.
3. No formal ISO/IEC 27701 certification.
4. No complete operator-level GDPR compliance assessment.
5. No complete retention schedule covering every data category.
6. No complete data-subject request workflow.
7. No documented incident-response process.
8. No demonstrated disaster-recovery/restore test in this repository.
9. Authorization and tenant-isolation regression coverage should be expanded.
10. Browser/SSRF security requires ongoing adversarial testing.

## 8. Recommended next assessment

After the next security-hardening cycle, repeat this assessment and attach evidence for:

- authorization tests;
- SSRF tests;
- dependency audit;
- container security review;
- backup restore test;
- production deployment verification;
- retention/deletion implementation;
- incident-response procedure.

Only after that should the project decide whether an external penetration test or formal certification effort is worthwhile.

## 9. Conclusion

Shortcode Gen already contains meaningful privacy and security engineering controls. It should **not**, however, be described as GDPR compliant, ISO/IEC 27001 certified, or ISO/IEC 27701 certified on the basis of this repository review.

The correct current position is:

> **Engineering controls exist and are being documented against recognised privacy and information-security principles. Formal independent assurance has not yet been performed.**
