# UFCL Mobile ERP — Operations Contacts

**Last updated:** ____________________  
**Maintained by:** ____________________

> Keep this document current. During an incident or deployment, this is the first document opened.

---

## Roles and Contacts

| Role | Name | Phone | Email / Chat | Availability |
|------|------|-------|--------------|--------------|
| **Deployment Owner** — authorises and oversees the deployment | | | | Business hours |
| **Rollback Authority** — has final say to abort and roll back | | | | Must be reachable during window |
| **Database Owner** — executes backup, migration, restore | | | | During deployment window |
| **Infrastructure Owner** — manages server, nginx, PM2, SSL | | | | During deployment window |
| **Product Owner** — approves release sign-off | | | | Business hours |
| **QA Lead** — signs off QA matrix and approves RC tag | | | | Business hours |
| **On-call Escalation** — available if primary contacts unreachable | | | | 24/7 during window |

---

## Communication

| Channel | Used for |
|---------|----------|
| **Primary channel** (Teams / WhatsApp / Slack): ____________________ | Real-time coordination during deployment |
| **Incident bridge**: ____________________ | Rollback decisions and escalations only |
| **Status page / notification method**: ____________________ | User-facing communication during maintenance |

---

## Maintenance Window

| Field | Value |
|-------|-------|
| Preferred window | e.g. Saturday 22:00 – 01:00 EAT |
| Maximum duration | 2 hours before automatic rollback is considered |
| User notification lead time | Minimum 24 hours for planned deployments |
| Emergency deployment notice | Minimum 30 minutes with on-call contact confirmed |

---

## External Dependencies

| Service | Provider | Contact / Support URL | Notes |
|---------|----------|-----------------------|-------|
| Production server (VPS/cloud) | | | SSH key held by: |
| Domain / DNS | | | |
| SSL certificate | | | Renews: |
| PostgreSQL hosting (if managed) | | | |

---

## Escalation Path

If a deployment decision cannot be made by the on-site team within 10 minutes, escalate in this order:

1. **Deployment Owner** → immediate first contact
2. **Rollback Authority** → if deployment owner is unreachable or the issue is above their authority
3. **Product Owner** → if the decision has business impact beyond the technical team

**Default rule:** If the escalation path is exhausted and a decision cannot be reached within 15 minutes of a blocking issue, execute the rollback procedure without waiting for approval.

---

## Quick Reference — Critical Commands

Paste the server-specific values here so they are available without opening another document.

```
SSH:          ssh user@your-server-ip
Project root: /path/to/ufcl-12
API root:     /path/to/ufcl-mobile-api
Backup dir:   /var/backups/ufcl/
PM2 service:  mobile-api
API port:     3001
DB name:      ufcl_db
DB user:      ufcl
nginx config: /etc/nginx/sites-available/ufcl-mobile-api
```

---

## Related Documents

| Document | Purpose |
|----------|---------|
| `DEPLOYMENT_RUNBOOK_v1.0.0.md` | Step-by-step deployment procedure |
| `QA_MATRIX_v0.20.html` | QA execution and sign-off |
| `RELEASE_NOTES_v1.0.0-rc1.html` | What's in the release, known limitations, rollback |
| `CHANGELOG.md` | Technical version history |
