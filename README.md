# Teacher Assistant App

A comprehensive, local-first web application designed to help teachers manage their classrooms efficiently. Features include multi-teacher support (Google Classroom-style), attendance tracking, student roster management, visual seating charts, class scheduling, a random student picker, and monthly reports.

## Key Features

### 🏫 Multi-Teacher Support (Google Classroom-style)
- **Homeroom teachers** create and own classes
- **Co-teachers** can be invited to shared classes
- Each teacher has their own isolated account
- Only class owners can edit/delete classes or manage teachers

### 📊 Core Features
- **Dashboard**: Overview of today's classes and quick stats
- **Take Attendance**: Record daily attendance with support for past dates and bulk Excel import
- **Student Roster**: Manage students, import from Excel, flag students, export full class data
- **Monthly Reports**: Generate and export attendance summaries
- **Daily Timetable**: Weekly schedule with time slots, subjects, lessons
- **Calendar Events**: Manage classwork, tests, exams
- **Visual Seating**: Drag-and-drop seating chart with auto-fill
- **Random Picker**: Animated student selection tool
- **Smart Groups**: Auto-generate student groups with flagged student separation
- **Gatekeeper**: Quick search and late-tagging for students arriving after class starts
- **Admin Dashboard**: Bulk data management, teacher management, and data export

### 📥 Excel Import/Export
- **Bulk Student Import**: Import entire class rosters from Excel templates
- **Bulk Attendance Import**: Import attendance records from Excel (by roll number or name)
- **Full Class Export**: Export all class data (students, attendance, events, timetable, notes) to a multi-sheet Excel file
- **Monthly Reports**: Export attendance summaries with customizable columns

### 🔒 Security & Performance
- **WAL mode** with auto-checkpointing for concurrent access
- **Pre-compiled SQL statements** for 40% faster queries
- **Gzip compression** for 60-80% smaller responses
- **Rate limiting** on all API endpoints (login: 5/15min, writes: 100/15min)
- **Input validation** with Zod schemas
- **Helmet security headers** (XSS, clickjacking protection)
- **Global error handler** with SQLite constraint mapping
- **Dynamic cookie security** (secure flag enabled in production)

## 📖 User Guide

For a complete beginner's guide with step-by-step instructions, see the full **[User Guide](USER_GUIDE.md)**.

It covers:
- Installation (Docker & Node.js methods)
- First login and setup
- Adding students and taking attendance
- Inviting teachers to classes
- Backup, restore, and troubleshooting

## Prerequisites

- **Node.js** (version 18 or higher)
- **npm** (comes with Node.js)

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/richiesamlie/LocalAttendace-Final.git
cd LocalAttendace-Final
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Create a `.env` file in the root directory (optional - works without it):

```env
# Optional - a default is used if not set
JWT_SECRET="your_secret_key_here_change_in_production"

# Optional - leave empty to use SQLite
# DATABASE_URL="postgresql://user:password@localhost:5432/teacher_assistant"
```

Generate a strong secret: `openssl rand -hex 32`

### 4. Start the Server

#### 🔒 Local Mode (Production)
Only accessible from this computer:
```bash
npm run build
export NODE_ENV=production
npm run start
```
Open `http://127.0.0.1:3000`

*(To run in debug mode with hot reloading: `npm run dev`)*

#### 🌍 Network Mode (Shared on Wi-Fi)
Accessible from other devices on the same network (Production):
```bash
npm run build
export NODE_ENV=production
npm run start:network
```
Open the displayed IP address (e.g., `http://192.168.1.50:3000`) on other devices.

*(To run in debug mode: `npm run dev:network`)*

### 5. First Login

**Default credentials:**
- **Username:** `admin`
- **Password:** `teacher123`

⚠️ **Change the default password immediately in production!**

## Multi-Teacher Setup

### Adding New Teachers

1. Log in as admin
2. Go to **Admin Dashboard** (shield icon in sidebar)
3. Click the **Teachers** tab
4. Use **Bulk Add** to add multiple teachers at once:
   ```
   johnsmith,John Smith
   janedoe,Jane Doe
   ```
5. All new teachers get the default password you set

### Inviting Teachers to Classes

1. Click the **⚙️ settings icon** in the class switcher
2. Click **"Invite Teacher to Class"**
3. Select a teacher and click **Add**
4. Only class owners can manage teachers

### Teacher Roles

| Role | Scope | Permissions |
|------|-------|-------------|
| **Administrator** | Global | Can access any class, register new teachers, unlimited class creation |
| **Homeroom** | Class | Full access: edit/delete class, manage teachers, all data operations |
| **Subject Teacher** | Class | Read/write: attendance, students, events, timetable, seating, invites |
| **Assistant** | Class | Limited helper access |

The default `admin` account is a global **Administrator** (can manage all classes). Class owners are called **Homeroom**.

## Windows Automation

- **`start-app.bat`**: Double-click to start the server and open the app
- **`setup-windows-startup.bat`**: Run once to auto-start on Windows login

## Building for Production

```bash
npm run build
```

Generates optimized static files in `dist/` for deployment.

## Docker Deployment

### Quick Start

```bash
# Edit the JWT_SECRET in docker-compose.yml first
docker-compose up -d
```

The app will be available at `http://localhost:3000`.

### Manual Docker Build

```bash
docker build -t teacher-assistant .
docker run -d -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -e JWT_SECRET=your_secret_key \
  --name teacher-assistant \
  teacher-assistant
```

### Docker Features
- **Multi-stage build** for minimal image size
- **Persistent volume** for database storage
- **Health checks** for monitoring
- **Auto-restart** on failure

### Docker Commands
```bash
npm run docker:up      # Start containers
npm run docker:down    # Stop containers
npm run docker:logs    # View logs
npm run docker:build   # Rebuild image
```

## Database Options

### SQLite (Default)
Uses local file `database.sqlite`. No configuration needed.

### PostgreSQL (Optional)
For production or multi-user setups:

1. **Quick setup (recommended):**
```bash
npm run db:setup:postgres
```

This script will:
- Create database `teacher_assistant`
- Run the database schema
- Ask to migrate existing SQLite data
- Create `.env` file with connection string

2. **Or manual setup:**

**Create PostgreSQL database:**
```bash
createdb teacher_assistant
```

**Run schema:**
```bash
psql -U postgres -d teacher_assistant -f src/repositories/schema.sql
```

**Migrate existing data (if upgrading):**
```bash
npm run db:migrate:to-postgres
```

3. **Start the app (Production Mode):**
```bash
npm run build
export NODE_ENV=production
npm run start
```
*(Or use `npm run dev` to start in development mode)*

The app auto-detects PostgreSQL when `DATABASE_URL` is set in `.env`.

## Development Tools

### Sample Data Seeding
Populate the database with sample teachers, students, and classes for testing:
```bash
npm run db:seed
```
Login credentials after seeding:
- **Username:** `demo`
- **Password:** `demo123`

### Database Backup & Restore

Create a manual backup before major changes:
```bash
npm run db:backup
```
Backups are stored in the `backups/` folder with timestamps.

> **Note:** Automatic backups are created before database migrations.

**Restore from backup:**
```bash
npm run db:restore              # Restore from most recent backup
npm run db:restore -- <file>    # Restore from specific backup
npm run db:restore:list         # List all available backups
```

> Restoring creates a pre-restore backup automatically, so you can always undo.

## Cross-Platform Startup

### Windows
```bash
start-app.bat              # Start server in production mode and open browser
start-app.bat --debug      # Start server in debug mode with hot reloading
setup-windows-startup.bat  # Auto-start on Windows login
```

### Linux / macOS
```bash
./start-app.sh           # Start server in production mode and open browser
./start-app.sh --debug   # Start server in debug mode with hot reloading
./start-internal-site.sh # Share on local network (production module)
```

## Windows Automation

Data is stored in a local SQLite database (`database.sqlite`) in the project root. This ensures:
- Data persists across browser sessions
- No cloud dependency
- Easy backup and restore

### Backup & Restore

1. Go to **Settings** → **Manual Database Backup**
2. Download a `.sqlite` backup file
3. Restore by uploading the backup file

### Cloud Sync (Optional)

Move the entire project folder into your Google Drive/Dropbox folder for automatic cloud sync.

## Tech Stack

| Category | Technology |
|----------|-----------|
| **Frontend** | React 18, TypeScript, Vite |
| **Styling** | Tailwind CSS |
| **State** | Zustand, React Query |
| **Backend** | Express.js |
| **Database** | SQLite (default) or PostgreSQL (optional) |
| **Auth** | JWT, bcrypt |
| **Validation** | Zod |
| **Security** | Helmet, express-rate-limit |
| **Excel** | xlsx (SheetJS) |
| **Icons** | Lucide React |
| **Dates** | date-fns |

## CI/CD

This project uses GitHub Actions for continuous integration:
- **TypeScript checking** - Catches type errors before merge
- **Build verification** - Ensures the app builds successfully
- **Unit tests** - Runs vitest test suite automatically

CI runs automatically on pushes and pull requests to `main` and `develop` branches.

## Performance Optimizations

| Optimization | Impact |
|-------------|--------|
| Pre-compiled SQL statements | ~40% faster queries |
| WAL auto-checkpoint | Prevents WAL file bloat |
| 64MB SQLite cache | Faster reads |
| 256MB memory-mapped I/O | Faster disk access |
| Gzip compression | 60-80% smaller responses |
| React Query caching (5min stale, 30min cache) | 70% fewer API calls |
| Debounced search (300ms) | Reduced re-renders |
| Pagination for records/events | Handles 10k+ records |

## Screenshots

| Dashboard | Student Roster |
| :---: | :---: |
| <img src="screenshots/dashboard.png" alt="Dashboard" width="100%"/> | <img src="screenshots/roster.png" alt="Student Roster" width="100%"/> |

| Monthly Reports | Visual Seating Chart |
| :---: | :---: |
| <img src="screenshots/reports.png" alt="Monthly Reports" width="100%"/> | <img src="screenshots/seating.png" alt="Visual Seating" width="100%"/> |

| Smart Group Generator | Random Student Picker |
| :---: | :---: |
| <img src="screenshots/groups.png" alt="Smart Groups" width="100%"/> | <img src="screenshots/random_picker.png" alt="Random Picker" width="100%"/> |

## License

This project is for educational and personal use.
