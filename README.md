<div align="center">

<img src="https://capsule-render.vercel.app/api?type=venom&height=260&color=0:12101C,50:45266F,100:FF6B45&text=VYRA&fontSize=100&fontColor=FFFFFF&fontAlignY=43&stroke=FF805F&strokeWidth=1&desc=MONEY%20IN%20MOTION&descSize=19&descAlignY=71&animation=fadeIn" width="100%" alt="VYRA"/>

### THE FINANCIAL EXPERIENCE, REIMAGINED.

<img src="https://readme-typing-svg.demolab.com?font=Space+Grotesk&weight=700&size=23&duration=2700&pause=900&color=FF7855&center=true&vCenter=true&width=760&lines=MONEY+WAS+NEVER+MEANT+TO+STAND+STILL.;NEITHER+WAS+ITS+INTERFACE.;WELCOME+TO+VYRA." alt="Money in motion"/>

<br/>

**An immersive financial experience where technology becomes intuitive, interactions become expressive, and money becomes something you can understand at a glance.**

<br/>

[![React](https://img.shields.io/badge/REACT-19-111020?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TYPESCRIPT-111020?style=for-the-badge&logo=typescript&logoColor=3178C6)](https://www.typescriptlang.org/)
[![Three.js](https://img.shields.io/badge/THREE.JS-3D-111020?style=for-the-badge&logo=threedotjs&logoColor=FFFFFF)](https://threejs.org/)
[![FastAPI](https://img.shields.io/badge/FASTAPI-API-111020?style=for-the-badge&logo=fastapi&logoColor=009688)](https://fastapi.tiangolo.com/)

<br/>

[**DISCOVER VYRA**](#-the-five-dimensions) · [**EXPLORE THE ARCHITECTURE**](#-inside-the-system) · [**RUN LOCALLY**](#-enter-vyra)

</div>

---


## 🌐 VYRA — LIVE WEBSITE

**[🚀 LAUNCH VYRA](https://vyra-production-adbf19d0.up.railway.app)**

Experience VYRA's interactive 3D fintech interface, account system, savings Vaults, Circles, and simulated payments.

**Status:** Public beta | Hosted on Railway

> VYRA currently uses simulated financial transactions. No real-money transfers are enabled.

---

## `01 / THE MANIFESTO`

### Finance doesn't need another ordinary interface.

It needs clarity. Personality. Movement.

**VYRA** explores a new language for digital finance—one where spending becomes a visual story, savings become visible progress, and financial interactions feel fluid rather than mechanical.

We believe a financial interface should be more than a collection of numbers.

> **Don't just track the movement. Experience it.**

```text
╔══════════════════════════════════════════════════════╗
║                                                      ║
║   V Y R A                                            ║
║                                                      ║
║   01  SEE THE MONEY.                                 ║
║   02  FEEL THE MOVEMENT.                             ║
║   03  OWN THE EXPERIENCE.                            ║
║                                                      ║
║   A DIFFERENT WAY TO INTERACT WITH FINANCE.           ║
║                                                      ║
╚══════════════════════════════════════════════════════╝
```

---

## `02 / THE FIVE DIMENSIONS`

### One experience. Five connected spaces.

<table>
<tr>
<td width="50%">

### 01 — HOME
**Your financial universe, at a glance.**

An expressive overview with a 3D money core, recent activity, financial highlights and quick actions.

</td>
<td width="50%">

### 02 — PAY
**Money, in motion.**

A focused interface for simulated payments and requests, with clear confirmation and transaction recording.

</td>
</tr>
<tr>
<td>

### 03 — FLOW
**Give your spending a shape.**

Explore transaction activity and spending patterns through an interactive visual experience.

</td>
<td>

### 04 — CIRCLES
**Better together.**

Visualize shared expenses, group balances and the financial relationships that connect people.

</td>
</tr>
<tr>
<td colspan="2" align="center">

### 05 — VAULTS
**Tomorrow starts with what you save today.**

Create personal savings goals, add contributions and see your progress move toward something meaningful.

</td>
</tr>
</table>

---

## `03 / THE EXPERIENCE ENGINE`

VYRA blends modern frontend engineering with a deliberately unconventional visual identity.

| EXPERIENCE LAYER | TECHNOLOGY | PURPOSE |
|:---|:---|:---|
| Interface | React | Component-driven experience |
| Language | TypeScript | Typed application logic |
| Visual engine | Three.js | Interactive 3D rendering |
| 3D integration | React Three Fiber + Drei | React-based 3D experiences |
| Motion | Motion | Animated interactions |
| Design language | CSS | Editorial layouts and styling |
| Backend | FastAPI | Authentication API |
| Storage | SQLite | Local user accounts |
| Identity | JWT | Authenticated sessions |
| Tooling | Vite | Frontend development and builds |

<details>
<summary><b>✦ Explore the interaction details</b></summary>

<br/>

- Cinematic entrance with an interactive 3D payment card
- Expressive typography and asymmetric compositions
- Animated transitions between financial spaces
- Custom cursor interactions
- Local transaction and savings simulation
- Reduced-motion preference
- Amount visibility controls
- Responsive interface and navigation
- Account creation and password-based login

</details>

---

## `04 / INSIDE THE SYSTEM`

```mermaid
flowchart TD
    V["VYRA"] --> UI["INTERACTIVE FRONTEND"]
    V --> API["AUTHENTICATION API"]

    UI --> HOME["HOME"]
    UI --> PAY["PAY"]
    UI --> FLOW["FLOW"]
    UI --> CIRCLES["CIRCLES"]
    UI --> VAULTS["VAULTS"]

    UI --> LOCAL[("LOCAL DEMO DATA")]

    API --> AUTH["ACCOUNT IDENTITY"]
    AUTH --> SQL[("SQLITE DATABASE")]

    style V fill:#FF7040,color:#ffffff,stroke:#FF7040
    style UI fill:#251B35,color:#ffffff,stroke:#9F78DD
    style API fill:#251B35,color:#ffffff,stroke:#9F78DD
```

The application currently uses a FastAPI authentication backend and browser-local simulated financial data.

---

## `05 / ENTER VYRA`

### Start the experience on your machine.

**01 — Clone the source**

```bash
git clone https://github.com/oishipaul45-engineer/VYRA.git
cd VYRA
```

**02 — Install the frontend**

```bash
npm install
```

**03 — Launch the interface**

```bash
npm run dev
```

**04 — Launch the local backend**

Create `backend/.env` with a private `VYRA_JWT_SECRET` of at least 32 characters.

Install Python dependencies from `backend/requirements.txt`, then start the FastAPI server:

```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app:app --port 8000
```

Open the address printed by Vite to enter VYRA.

> Never commit `backend/.env`, authentication secrets or local user databases.

---

## `06 / THE JOURNEY`

```mermaid
flowchart LR
    A["DESIGN"] --> B["INTERACTION"]
    B --> C["IDENTITY"]
    C --> D["CONNECTED DATA"]
    D --> E["DEPLOYMENT"]
    E --> F["PAYMENT INTEGRATIONS"]

    style A fill:#FF7040,color:#fff,stroke:#FF7040
    style B fill:#FF7040,color:#fff,stroke:#FF7040
    style C fill:#FF7040,color:#fff,stroke:#FF7040
```

**Current foundations:** immersive frontend, simulated financial workflows and local authentication.

**Next direction:** persistent account-linked financial data, deployment, better insights and collaborative features.

**Long-term exploration:** real payment connectivity through appropriately regulated partners, with the required compliance and security controls.

---

## `07 / FINANCIAL INTEGRITY`

VYRA's current payment and balance experiences are simulations. No actual bank transfers, UPI settlements or real-money transactions are enabled.

The authentication system is intended for local development and needs additional production security work before public deployment.

---

<div align="center">

### FINANCE, WITHOUT THE ORDINARY.

<img src="https://readme-typing-svg.demolab.com?font=Space+Grotesk&weight=800&size=25&duration=2400&pause=1200&color=FF7040&center=true&vCenter=true&width=700&lines=DESIGNED+TO+MOVE.;BUILT+TO+FEEL+DIFFERENT.;VYRA+%E2%80%94+MONEY+IN+MOTION." alt="VYRA signature"/>

<br/>

**CREATED BY [OISHI PAUL](https://github.com/oishipaul45-engineer)**

[![GitHub](https://img.shields.io/badge/EXPLORE%20THE%20SOURCE-VYRA-FF7040?style=for-the-badge&logo=github&logoColor=white)](https://github.com/oishipaul45-engineer/VYRA)

<br/>

**VYRA® / MONEY IN MOTION**

<img src="https://capsule-render.vercel.app/api?type=waving&height=120&section=footer&color=0:FF7040,50:6031AB,100:12101C" width="100%" alt=""/>

</div>