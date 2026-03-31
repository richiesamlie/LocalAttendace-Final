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
- **Rate limiting** on all API endpoints
- **Input validation** with Zod schemas
- **Helmet security headers** (XSS, clickjacking protection)

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

Create a `.env` file in the root directory:

```env
JWT_SECRET="your_secret_key_here_change_in_production"
```

Generate a strong secret: `openssl rand -hex 32`

### 4. Start the Server

#### 🔒 Local Mode (Default)
Only accessible from this computer:
```bash
npm run dev
```
Open `http://127.0.0.1:3000`

#### 🌍 Network Mode (Shared on Wi-Fi)
Accessible from other devices on the same network:
```bash
npm run dev:network
```
Open the displayed IP address (e.g., `http://192.168.1.50:3000`) on other devices.

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

| Role | Permissions |
|------|-------------|
| **Owner** | Full access: edit/delete class, manage teachers, all data operations |
| **Teacher** | Read/write access: attendance, students, events, timetable, seating |

## Windows Automation

- **`start-app.bat`**: Double-click to start the server and open the app
- **`setup-windows-startup.bat`**: Run once to auto-start on Windows login

## Building for Production

```bash
npm run build
```

Generates optimized static files in `dist/` for deployment.

## Data Storage

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
| **Database** | SQLite (better-sqlite3) |
| **Auth** | JWT, bcrypt |
| **Validation** | Zod |
| **Security** | Helmet, express-rate-limit |
| **Excel** | xlsx (SheetJS) |
| **Icons** | Lucide React |
| **Dates** | date-fns |

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
