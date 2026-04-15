# Agent Discovery E2E Test Report

Generated: 2026-04-15T01:46:29.452Z
Network tests: SKIPPED

## Catalog Overview

- Version: 1.0.0
- Total entries: 687
- Sources: awesome-copilot, gh-aw
- Types: agent=213, instruction=178, skill=1
- Duplicate clusters: 4

## Search Quality

- Total queries tested: 48
- Non-empty results: 48/48 (100%)
- **Precision@1**: 72.9%
- **Precision@3**: 79.2%
- **Precision@5**: 87.5%

Source distribution:
  - awesome-copilot: 441 results
  - gh-aw: 5 results

### Per-Project Results

| Project | Query | Results | Top Result | P@1 | P@3 | P@5 |
|---------|-------|---------|------------|-----|-----|-----|
| react-saas-startup | react frontend dashboard | 10 | Expert React Frontend Eng... | Y | Y | Y |
| react-saas-startup | typescript best practices | 10 | Containerization Docker B... | N | N | N |
| react-saas-startup | saas authentication | 3 | Azure SaaS Architect mode... | N | N | N |
| azure-enterprise-iac | azure bicep terraform | 10 | Azure Terraform IaC Imple... | Y | Y | Y |
| azure-enterprise-iac | infrastructure as code | 10 | Azure Terraform Infrastru... | Y | Y | Y |
| azure-enterprise-iac | cloud deployment | 10 | Kubernetes Deployment Bes... | N | Y | Y |
| python-data-science | python machine learning | 10 | Python MCP Server Expert | Y | Y | Y |
| python-data-science | data science pipeline | 10 | Use Cliche Data In Docs | Y | Y | Y |
| python-data-science | python code review | 10 | Gilfoyle Code Review Mode | N | N | Y |
| go-microservices-k8s | go microservices | 10 | Go | Y | Y | Y |
| go-microservices-k8s | kubernetes deployment | 10 | Kubernetes Deployment Bes... | Y | Y | Y |
| go-microservices-k8s | api design | 10 | API Architect | Y | Y | Y |
| java-spring-boot | java spring boot | 10 | Java MCP Expert | Y | Y | Y |
| java-spring-boot | rest api design | 10 | Aspnet Rest Apis | Y | Y | Y |
| java-spring-boot | java best practices | 10 | Containerization Docker B... | N | N | N |
| rust-systems | rust systems programming | 10 | Rust | Y | Y | Y |
| rust-systems | performance optimization | 10 | Performance Optimization | Y | Y | Y |
| rust-systems | rust code review | 10 | Gilfoyle Code Review Mode | N | N | Y |
| devops-cicd | ci cd pipeline | 10 | Github Actions Ci Cd Best... | Y | Y | Y |
| devops-cicd | github actions | 10 | GitHub Actions Expert | Y | Y | Y |
| devops-cicd | deployment automation | 10 | Joyride Workspace Automat... | Y | Y | Y |
| react-native-mobile | react native mobile | 10 | Gem Implementer Mobile | Y | Y | Y |
| react-native-mobile | mobile app development | 10 | Power Apps Code Apps | Y | Y | Y |
| react-native-mobile | typescript mobile | 10 | Gem Designer Mobile | Y | Y | Y |
| security-audit | security audit | 10 | JFrog Security Agent | Y | Y | Y |
| security-audit | vulnerability assessment | 2 | CAST Imaging Impact Analy... | N | Y | Y |
| security-audit | code security review | 10 | Gilfoyle Code Review Mode | Y | Y | Y |
| adr-architecture | architecture decision record | 10 | Plan Mode   Strategic Pla... | Y | Y | Y |
| adr-architecture | adr documentation | 9 | Adr Writer | Y | Y | Y |
| adr-architecture | technical design | 9 | Technical Content Evaluat... | Y | Y | Y |
| technical-writing | technical documentation | 9 | Technical Content Evaluat... | Y | Y | Y |
| technical-writing | api documentation | 10 | Gem Documentation Writer | Y | Y | Y |
| technical-writing | writing style guide | 10 | Html Css Style Color Guid... | N | N | Y |
| game-dev-unity | unity game development | 10 | Power Bi Custom Visuals D... | N | N | N |
| game-dev-unity | csharp game scripting | 8 | Azure Durable Functions C... | Y | Y | Y |
| game-dev-unity | game design patterns | 10 | Oop Design Patterns | N | N | N |
| embedded-iot | embedded systems firmware | 9 | .NET Self Learning Archit... | Y | Y | Y |
| embedded-iot | iot protocol | 10 | C# MCP Server Expert | Y | Y | Y |
| embedded-iot | c cpp embedded | 10 | Cpp Language Service Tool... | Y | Y | Y |
| dotnet-migration | dotnet migration | 10 | Oracle To PostgreSQL Migr... | Y | Y | Y |
| dotnet-migration | csharp modernization | 9 | Modernization Agent | N | Y | Y |
| dotnet-migration | legacy code refactoring | 10 | WG Code Alchemist | N | N | Y |
| oss-library-maintainer | open source maintenance | 10 | OpenAPI to Application Ge... | Y | Y | Y |
| oss-library-maintainer | code review best practices | 10 | Bicep Code Best Practices | Y | Y | Y |
| oss-library-maintainer | npm package publishing | 6 | Debian Linux Expert | N | N | N |
| nextjs-fullstack | nextjs fullstack | 2 | Nextjs | Y | Y | Y |
| nextjs-fullstack | typescript web app | 10 | Power Apps Code Apps | Y | Y | Y |
| nextjs-fullstack | react server components | 10 | Expert React Frontend Eng... | Y | Y | Y |

## Recommend Quality

- Total queries: 16
- Avg candidate count: 18.1
- Avg delta (recommend vs search): +2.6 more results
- Type diversity: agent=184, instruction=105

## Agent Details (Network)

SKIPPED (SKIP_NETWORK=1)

## Download Agent (Network)

SKIPPED (SKIP_NETWORK=1)

## Deduplication Report

- Clusters found: 4
- Avg description Jaccard: 0.145
- Avg name overlap: 0.354
- Avg combined score: 0.198
- Search results with alternatives shown: 1

### Clusters

- **Adr**: ADR Generator (awesome-copilot), Adr Writer (gh-aw) [desc=0.088 name=0.5 combined=0.163]
- **Writer**: Gem Documentation Writer (awesome-copilot), Technical Doc Writer (gh-aw) [desc=0.188 name=0.333 combined=0.238]
- **Agentic**: Meta Agentic Project Scaffold (awesome-copilot), Agentic Workflows (gh-aw) [desc=0.167 name=0.25 combined=0.204]
- **Writer**: SE: Tech Writer (awesome-copilot), W3c Specification Writer (gh-aw) [desc=0.136 name=0.333 combined=0.186]

## Variance Report (KEY TEST)

**Overall Verdict: EXCELLENT — catalog produces highly differentiated results**

- Average Jaccard similarity: 0.183
- High variance pairs (Jaccard < 0.3): 8
- Moderate variance pairs (0.3-0.6): 1
- Low variance pairs (Jaccard > 0.6): 0

### Pair-by-Pair Results

| Pair | Jaccard | Top-1 Different? | Expected? | Verdict |
|------|---------|-----------------|-----------|---------|
| Azure IaC vs Azure SaaS | 0.25 | YES | YES | HIGH_VARIANCE |
| React Frontend vs React Native Mobile | 0.25 | YES | YES | HIGH_VARIANCE |
| Python Web API vs Python ML Pipeline | 0.111 | YES | YES | HIGH_VARIANCE |
| Java Spring Boot vs Java Android | 0.25 | YES | YES | HIGH_VARIANCE |
| DevOps CI/CD vs DevOps Monitoring | 0 | YES | YES | HIGH_VARIANCE |
| Security Audit vs Security Compliance | 0.429 | YES | NO | MODERATE_VARIANCE (!) |
| Technical Documentation vs ADR Writing | 0 | YES | YES | HIGH_VARIANCE |
| Code Review vs Code Refactoring | 0.25 | YES | YES | HIGH_VARIANCE |
| Frontend Testing vs Backend Testing | 0.111 | YES | NO | HIGH_VARIANCE (!) |

### Detailed Pair Analysis

#### Azure IaC vs Azure SaaS
- Rationale: IaC needs deployment/infrastructure agents; SaaS needs app architecture/auth agents
- Jaccard: 0.25 → **HIGH_VARIANCE**
- Proposal A top-5: Azure Terraform Infrastructure Planning, Azure Terraform IaC Implementation Specialist, Azure AVM Bicep mode, Azure AVM Terraform mode, Azure Verified Modules Bicep
- Proposal B top-5: Azure SaaS Architect mode instructions, Azure Iac Exporter, Azure AVM Bicep mode, Azure AVM Terraform mode, Azure Principal Architect mode instructions

#### React Frontend vs React Native Mobile
- Rationale: Web frontend needs web/CSS/component agents; mobile needs native/device agents
- Jaccard: 0.25 → **HIGH_VARIANCE**
- Proposal A top-5: Expert React Frontend Engineer, Expert Vue.js Frontend Engineer, Frontend Performance Investigator, Pcf React Platform Libraries, TypeScript MCP Server Expert
- Proposal B top-5: Gem Implementer Mobile, Gem Mobile Tester, Expert React Frontend Engineer, Gem Designer Mobile, Pcf React Platform Libraries

#### Python Web API vs Python ML Pipeline
- Rationale: Web API needs API design/backend agents; ML needs data science/model agents
- Jaccard: 0.111 → **HIGH_VARIANCE**
- Proposal A top-5: Dataverse Python Api Reference, Aspnet Rest Apis, API Architect, Python MCP Server Expert, Python Notebook Sample Builder
- Proposal B top-5: Dataverse Python, Dataverse Python Advanced Features, Dataverse Python Agentic Workflows, Dataverse Python Api Reference, Dataverse Python Authentication Security

#### Java Spring Boot vs Java Android
- Rationale: Spring Boot needs backend/API agents; Android needs mobile/UI agents
- Jaccard: 0.25 → **HIGH_VARIANCE**
- Proposal A top-5: Java MCP Expert, Convert Cassandra To Spring Data Cosmos, Convert Jpa To Spring Data Cosmos, Java Mcp Server, Java 11 To Java 17 Upgrade
- Proposal B top-5: Salesforce UI Development (Aura & LWC), Gem Designer Mobile, Gem Mobile Tester, Java MCP Expert, Java 11 To Java 17 Upgrade

#### DevOps CI/CD vs DevOps Monitoring
- Rationale: CI/CD needs build/deploy agents; observability needs monitoring/metrics agents
- Jaccard: 0 → **HIGH_VARIANCE**
- Proposal A top-5: Github Actions Ci Cd Best Practices, GitHub Actions Expert, GitHub Actions Node Runtime Upgrade, SE: DevOps/CI, Joyride Workspace Automation
- Proposal B top-5: Dynatrace Expert, Power BI Performance Expert Mode

#### Security Audit vs Security Compliance
- Rationale: Both are security-related — catalog may not distinguish well between audit and compliance
- Jaccard: 0.429 → **MODERATE_VARIANCE**
- Proposal A top-5: JFrog Security Agent, SE: Security, Power Bi Security Rls Best Practices, Stackhawk Security Onboarding, TDD Refactor Phase   Improve Quality & Security
- Proposal B top-5: Azure Policy Analyzer, JFrog Security Agent, Power Bi Security Rls Best Practices, Agent Governance Reviewer, SE: Security

#### Technical Documentation vs ADR Writing
- Rationale: Tech docs need documentation agents; ADRs need architecture/decision agents
- Jaccard: 0 → **HIGH_VARIANCE**
- Proposal A top-5: TaxCore Technical Writer, Gem Documentation Writer, Technical Content Evaluator
- Proposal B top-5: Adr Writer, Project Architecture Planner, Plan Mode   Strategic Planning & Architecture, Dotnet Architecture Good Practices

#### Code Review vs Code Refactoring
- Rationale: Review needs review/lint agents; refactoring needs refactoring/migration agents
- Jaccard: 0.25 → **HIGH_VARIANCE**
- Proposal A top-5: Gilfoyle Code Review Mode, Electron Code Review Mode Instructions, Code Review Generic, Gilfoyle Code Review, WG Code Alchemist
- Proposal B top-5: WG Code Alchemist, Update Code From Shorthand, Gem Code Simplifier, Gilfoyle Code Review Mode, Modernization Agent

#### Frontend Testing vs Backend Testing
- Rationale: Testing agents may overlap significantly across frontend/backend
- Jaccard: 0.111 → **HIGH_VARIANCE**
- Proposal A top-5: Expert Vue.js Frontend Engineer, Expert React Frontend Engineer, DevTools Regression Investigator, Frontend Performance Investigator, Terratest Module Testing
- Proposal B top-5: Terratest Module Testing, Dataverse Python Testing Debugging, Apify Integration Expert, Power Platform MCP Integration Expert, API Architect

---

## Recommendations

- All metrics look healthy. No immediate action needed.
