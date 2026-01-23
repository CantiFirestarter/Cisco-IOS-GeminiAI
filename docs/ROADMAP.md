# Cisco IOS AI - Strategic Roadmap

**Last Updated: Jan 2026**

This document outlines the planned trajectory for the Cisco IOS AI. Our goal is to evolve from a documentation synthesizer into an active configuration and design partner for network engineers.

## 🚀 Phase 1: Foundations (Current)
*Status: Completed/Ongoing*
- [x] Deterministic command synthesis for IOS, IOS XE, and IOS XR.
- [x] Research Mode integration with Google Search Grounding.
- [x] Local-first architecture with optional Google Drive Sync.
- [x] Multi-modal support (Voice input, Image analysis for network diagrams).
- [x] Onboarding flow for personal Gemini API key management.
- [x] **Deployment support for Cloudflare Workers (Workers + Assets).**

## 🛠 Phase 2: Enhanced Operability (Q1-Q2 2026)
*Focus: Efficiency and Practical Utility*
- **Export Engine**: One-click export of synthesized commands to `.cfg`, `.txt`, and `.json`.
- **Diff Viewer**: Compare suggested configurations against user-provided running-configs.
- **NX-OS/ACI Refinement**: Dedicated protocols for Data Center specific platforms.
- **Local LLM Support**: Integration options for WebLLM/Transformers.js for 100% offline baseline queries.
- **Interactive Sandbox**: A simulated terminal environment to "test drive" synthesized commands before production.

## 🧠 Phase 3: Intelligence & Verification (Q3-Q4 2026)
*Focus: Safety and Architectural Design*
- **DevNet Sandbox Integration**: Connect to Cisco DevNet Always-On sandboxes to verify syntax on real virtual hardware.
- **Security Hardening Scorecard**: Automatically evaluate suggested configs against Cisco's security best practices.
- **Topology Awareness**: Ability to upload multiple diagrams and maintain context of an entire multi-device fabric.
- **Audit Report Generation**: Professional PDF/Markdown report generation for configuration changes and maintenance logs.

## 🌐 Phase 4: Ecosystem & Integration (2027)
*Focus: Automation and Scale*
- **IaC Transformation**: Convert natural language CLI requests directly into Ansible Playbooks or Terraform HCL.
- **Controller API Connectors**: Push validated configurations directly to DNA Center or vManage via secure API calls.
- **Collaborative Design Sessions**: Shared "War Rooms" via Peer-to-Peer synchronization for real-time collaborative design.
- **Advanced Troubleshooting Simulator**: AI-driven "Chaos Engineering" scenarios to train junior engineers in high-pressure environments.

---
*The roadmap is a living document and subject to change based on community feedback and advancements in Google's Gemini models.*