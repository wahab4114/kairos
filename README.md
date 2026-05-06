# Kairos - Stock Assistant

A lightweight, fast personal stock assistant app for managing your investment portfolio and getting buy/sell notifications.

## Features (MVP)

- 📈 **Watchlist Management** - Track stocks from your Scalable Capital portfolio
- 🔔 **Buy/Sell Notifications** - Get alerted when stocks hit your target prices
- 💬 **Chat Interface** - AI-powered trading assistant (Phase 2)

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: CSS (can add Tailwind)
- **Responsive**: Mobile-first design for web and mobile apps

## Project Structure

```
src/
├── components/
│   ├── Watchlist/       # Watchlist component & sub-components
│   ├── Notifications/   # Notification display
│   └── Chat/            # Chat interface (Phase 2)
├── pages/               # Page components
├── services/            # API integration (Scalable Capital, etc.)
├── hooks/               # Custom React hooks
├── utils/               # Helper functions
├── types/               # TypeScript types & interfaces
├── App.tsx              # Main app component
├── main.tsx             # App entry point
└── index.css            # Global styles
```

## Quick Start

### Development

```bash
npm install      # Already done ✓
npm run dev      # Start development server (port 3000)
```

### Build

```bash
npm run build    # Build for production
npm run preview  # Preview production build
```

## Integration Points (TODO)

- [ ] Scalable Capital API connection
- [ ] Stock price updates
- [ ] Notification system
- [ ] User preferences/settings
- [ ] Chat AI integration (Phase 2)

## Notes

- Single-user app (testing phase)
- Lightweight & fast first principle
- German market focus (€EUR)
- Web + Mobile responsive
