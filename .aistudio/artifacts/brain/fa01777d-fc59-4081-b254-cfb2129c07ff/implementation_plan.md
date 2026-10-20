# Implementation Plan: ZaFlow Rebranding & Modern UI Refresh

## Title & Summary
Transform application to **ZaFlow** with a **Modern Slate Minimalist** design. Update navigation to a collapsable sidebar, implement a live logo upload system for Super Admins, and refine the overall visual identity without feature changes.

## User Review & Critical Decisions
[!IMPORTANT]
- **Confirmed Design**: Modern Slate Minimalist palette (slate neutrals, clean borders, refined typography).
- **Confirmed Navigation**: Collapsable sidebar with breadcrumb header.
- **Confirmed Logo Feature**: Super Admin panel will allow both direct image file uploads and URL input with live preview.

## 1. Overview & Core Concept
- **What It Does**: Full rebrand to ZaFlow, modernized UI aesthetic, and enhanced admin control.
- **Key Value**: Professional, brand-aligned interface with streamlined navigation and easier brand asset management.

## 2. User Experience & Visual Design
- **Visual Identity**:
  - **Palette**: Slate-based (`slate-900`, `slate-800`, `slate-100`, `slate-50`), white canvas background, crisp hairline borders.
  - **Typography**: `Plus Jakarta Sans` for UI, `JetBrains Mono` for tabular data.
  - **Component Style**: Flat surfaces, subtle 1px border lines, single-elevation depth.
- **Key Flow**: 
  - Admin settings will include a new "Brand Identity" section.
  - Main app navigation moves to a collapsable sidebar.

## 3. Key Product Decisions & Trade-Offs
- **Decision**: Centralizing Logo State.
  - *Chosen Approach*: Store logo URL in the `brands` table.
  - *Why*: Ensures logo branding is associated with specific brand entities.
- **Decision**: Navigation.
  - *Chosen Approach*: Collapsable Sidebar.
  - *Why*: Maximizes main content area while providing quick access to all features.

## 4. Technical Architecture
```text
┌───────────────────────────────────────┐
│ Sidebar Navigation (Collapsable)      │
├───────────────────────────────────────┤
│ Header: Breadcrumbs + User Profile    │
├───────────────────────────────────────┤
│ Main Viewport                         │
└───────────────────────────────────────┘
```
- **Database**: Add `logo_url` column to the `brands` table.
- **State**: Centralized `brand` state will hold logo info, accessible globally to ensure consistent branding across views.
- **Admin**: New `LogoSettingsModal` component.
