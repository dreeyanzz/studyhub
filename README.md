# StudyHub

> **Web-Based Co-Working Space and Study Spot Discovery and Reservation Platform**  
> *Course: Software Development 1*

---

## 📌 Overview

**StudyHub** is a centralized, responsive web platform designed to solve the seat-finding and workspace-uncertainty problem faced by students, freelancers, and remote learners. Through a live, host-updated snap-grid seat map, multi-filter search, and a *reserve-now* instant seat-hold workflow, users can discover conducive study spots, inspect verified amenities (Wi-Fi tiers, power socket availability, noise levels), and secure an exact desk before commuting.

---

## 👥 Development Team

* **Adrian Seth Tabotabo**
* **Maria Faith Antigua**
* **Luke Miguel Dongque**
* **James Niño Mandawe**

---

## 🚀 Key Architectural Features (v2.0)

1. **Space Discovery & Multi-Filter Search**: Search by location/radius, operational hours, noise level, Wi-Fi speed tier, power outlet availability, and curated/custom tags.
2. **Reserve-Now Exact-Seat Selection**: Current-state reservation model featuring interactive snap-grid seat maps where seekers select and hold specific seats.
3. **Pending-Payment Sandbox Flow**: 10-minute hold window backed by a sandbox payment gateway with automatic seat release upon expiry.
4. **Host Seat-Map & Occupancy Management**: In-browser snap-grid layout builder enabling hosts to position desks, amenities, and toggle seat states (Available, Occupied, Reserved, Maintenance) in real time.
5. **Role-Based Access Control & Security**: Supabase Auth with Row-Level Security (RLS) enforcing strict permissions across Seekers, Hosts, and Administrators.
6. **Community Reviews & Moderation**: Verified-user ratings, amenity feedback, and administrative moderation tools.

---

## 📂 Repository Contents

```text
studyhub/
├── README.md                     # Project overview
├── .github/                      # PR template, issue forms, PR title check
├── .gitattributes                # LF line endings for text files; binary file rules
├── .editorconfig                 # Editor defaults (UTF-8 without BOM, LF, 2 spaces)
└── docs/
    └── course/                   # Course deliverables (.md is the source; .docx is generated)
        ├── StudyHub_SRS.md / .docx
        ├── StudyHub_Project_Planning_Worksheet.md / .docx
        ├── StudyHub_Sprint_1_Plan.md
        ├── StudyHub_Project_Management_Board.html / .svg
        ├── diagrams/             # Seat state machine, tag taxonomy, seat map layout
        └── archive/              # v1 originals kept for audit
```

---

## 📑 Documentation Links

- [Software Requirements Specification (SRS v2.0)](docs/course/StudyHub_SRS.md)
- [Project Planning Worksheet (v2.0)](docs/course/StudyHub_Project_Planning_Worksheet.md)
- [Sprint 1 Plan](docs/course/StudyHub_Sprint_1_Plan.md)

---

## 🛠️ Tech Stack & Constraints

- **Frontend**: Next.js / React, Tailwind CSS, TypeScript
- **Backend & Database**: Supabase (PostgreSQL, Supabase Auth, Row-Level Security, Realtime)
- **Deployment**: Vercel / Cloudflare
