# 837 Claim Processing Platform

A comprehensive, HIPAA-compliant platform for automating the complete lifecycle of medical claim (837) processing—from ingestion through validation, correction, transmission, and monitoring.

## Features

- 🔄 **End-to-End Automation**: Ingestion → Parsing → Validation → Correction → Transmission
- 🤖 **AI-Powered Corrections**: Azure OpenAI integration for intelligent claim analysis
- 📊 **Comprehensive Dashboards**: Real-time metrics and historical analytics
- 🔒 **HIPAA Compliant**: AES-256 encryption, audit trails, role-based access control
- ⚡ **High Performance**: Process ≥10,000 claims per hour
- 🎯 **Rule Engine**: Configurable validation and correction rules

## Tech Stack

### Backend
- Node.js with Express.js
- PostgreSQL with JSONB support
- Azure OpenAI for AI assistance
- Redis for caching
- Winston for logging

### Frontend
- React 18 with TypeScript
- Vite build tool
- Tailwind CSS
- Recharts for visualizations
- React Router DOM

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis (optional, for caching)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   cd frontend && npm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. Set up the database:
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

5. Start the development servers:
   ```bash
   npm run dev
   ```

The backend will run on http://localhost:3000 and the frontend on http://localhost:5173

## Database Configuration

Connection details:
- Host: localhost
- Port: 5434
- Database: Claim837
- User: postgres
- Password: hlnotes

## Project Structure

```
.
├── backend/
│   ├── config/          # Configuration files
│   ├── controllers/     # Request handlers
│   ├── database/        # Database migrations and seeds
│   ├── middleware/      # Custom middleware
│   ├── models/          # Data models
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── utils/           # Utility functions
│   └── server.js        # Entry point
├── frontend/
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── pages/       # Page components
│   │   ├── services/    # API services
│   │   ├── hooks/       # Custom hooks
│   │   └── App.tsx      # Main app component
│   └── public/          # Static assets
└── uploads/             # File upload directory
```

## API Endpoints

### Authentication
- POST /api/v1/auth/login
- POST /api/v1/auth/logout
- POST /api/v1/auth/refresh

### Claims
- POST /api/v1/claims/upload
- GET /api/v1/claims
- GET /api/v1/claims/:id
- PUT /api/v1/claims/:id/correct
- POST /api/v1/claims/:id/transmit

### Validation
- GET /api/v1/validations/:claimId
- POST /api/v1/validations/rules

### Dashboard
- GET /api/v1/dashboard/metrics
- GET /api/v1/dashboard/trends

## License

MIT
