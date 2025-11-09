# Security Notes

This document tracks security vulnerabilities and mitigation strategies for the Perplexica project.

## Current Vulnerabilities

### 1. @langchain/community - expr-eval Vulnerability

**Status:** Known issue - Not fixed
**Severity:** High
**CVE:** GHSA-jc85-fpwf-qm7x

#### Description
The `expr-eval` dependency (used by `@langchain/community` >= 0.0.41) does not restrict functions passed to the evaluate function, potentially allowing arbitrary code execution.

#### Current Version
- **Installed:** @langchain/community@^1.0.0
- **Vulnerable:** All versions >= 0.0.41

#### Potential Fix
Downgrading to `@langchain/community@0.0.40` would resolve the vulnerability.

**⚠️ WARNING:** Downgrading may break existing features that depend on newer @langchain/community functionality. The current version (1.0.0) is significantly newer than 0.0.40, and such a downgrade would likely introduce breaking changes.

#### Recommendation
- **Monitor** the @langchain/community repository for security patches
- **Review** the expr-eval usage in the application to understand the risk exposure
- **Consider** implementing additional input validation and sandboxing for any user-controlled expressions
- **Wait** for an upstream patch from @langchain/community that addresses this vulnerability without breaking changes

#### Related Packages
- expr-eval (all versions currently affected)
- @langchain/community (versions >= 0.0.41)

---

### 2. esbuild - Development Server SSRF Vulnerability

**Status:** Known issue - Not fixed
**Severity:** Moderate
**CVE:** GHSA-67mh-4wv8-2f99

#### Description
esbuild versions <= 0.24.2 enable any website to send requests to the development server and read the response, potentially exposing local resources during development.

#### Current Version
- **Installed:** esbuild <= 0.24.2 (via drizzle-kit dependency)
- **Vulnerable:** All versions <= 0.24.2

#### Potential Fix
Upgrading would require updating drizzle-kit to version 0.31.6, which is a breaking change from the current version (0.30.5).

#### Recommendation
- **Production Impact:** This vulnerability primarily affects development environments, not production deployments
- **Mitigation:** Use network restrictions and firewall rules to limit access to development servers
- **Monitor** drizzle-kit releases for a stable version that includes the esbuild update
- **Evaluate** the breaking changes in drizzle-kit@0.31.6 before upgrading

---

## Fixed Vulnerabilities (as of 2025-11-09)

### Next.js Critical Security Update

**Status:** ✅ Fixed
**Previous Version:** 15.2.2
**Updated Version:** 15.5.6
**Severity:** Critical (CVSS 9.1)

#### Fixed CVEs
1. **GHSA-f82v-jwr5-mffw** - Authorization Bypass in Next.js Middleware
2. **GHSA-4342-x723-ch2f** - Improper Middleware Redirect Handling Leads to SSRF
3. **GHSA-xv57-4mr9-wg8v** - Content Injection Vulnerability for Image Optimization
4. **GHSA-g5qg-72qw-gw5v** - Cache Key Confusion for Image Optimization API Routes

### Other Fixed Vulnerabilities

The following vulnerabilities were automatically fixed via `npm audit fix`:

1. **brace-expansion** - Regular Expression Denial of Service (ReDoS)
2. **braces** - Uncontrolled resource consumption
3. **cross-spawn** - Regular Expression Denial of Service (ReDoS)
4. **jspdf** - Denial of Service (DoS)
5. **mammoth** - Directory Traversal vulnerability
6. **micromatch** - Regular Expression Denial of Service (ReDoS)
7. **nanoid** - Predictable results with non-integer values
8. **tar** - Race condition leading to uninitialized memory exposure
9. **tar-fs** - Symlink validation bypass and extraction outside specified directory

---

## Security Maintenance

### Regular Audits
Run `npm audit` regularly to check for new vulnerabilities:
```bash
npm audit
```

### Safe Updates
To fix non-breaking vulnerabilities automatically:
```bash
npm audit fix
```

### Breaking Updates
To fix all vulnerabilities (including those requiring breaking changes):
```bash
npm audit fix --force
```
**⚠️ WARNING:** This may break existing functionality. Always test thoroughly after running this command.

---

## Last Updated
2025-11-09

## Review Schedule
This document should be reviewed monthly or whenever new security advisories are published for project dependencies.
