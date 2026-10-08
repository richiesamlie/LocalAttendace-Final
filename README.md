# Teacher Assistant

A fast, offline-first web application designed for teachers to manage classrooms: attendance, student rosters, seating charts, timetables, and reports.

Everything runs locally on your computer — no internet connection is required, and your data never leaves your machine.

---

## What It Does

- **Take Attendance:** Mark present, late, absent, or excused in a few clicks. Supports daily homeroom and subject-based attendance.
- **Student Rosters:** Manage student profiles, contacts, and notes. Import and export rosters using Excel (`.xlsx`).
- **Seating Charts:** Visual drag-and-drop classroom desk layouts.
- **Timetables & Calendar:** Plan weekly class schedules and track school events.
- **Reports:** Generate printable monthly attendance summaries and export them to Excel.
- **Offline First:** All data is saved on your computer in a single file (`database.sqlite`).
- **Classroom Wi-Fi Sharing (Optional):** Broadcast the app across your classroom Wi-Fi so you can take attendance from your phone or tablet.

---

## Download & Run (For Teachers)

No installation of Node.js, Git, or command-line tools is required. Download the latest build from [**GitHub Releases**](https://github.com/richiesamlie/LocalAttendace-Final/releases/latest):

| File | Type | Best For |
|---|---|---|
| **`TeacherAssistant-Setup.exe`** | Windows Installer | Most Windows users. Installs to your user folder, creates Desktop & Start Menu shortcuts, and includes an uninstaller. |
| **`TeacherAssistant-v1.0.0-Windows-Portable.zip`** | Portable ZIP | Running from a USB flash drive or computers where you cannot install software. Unzip and run. |

### Quick Start in 3 Steps

1. **Launch:** Double-click the **Teacher Assistant** shortcut on your Desktop (or `TeacherAssistant.exe` in the portable folder).
   - The app appears in your **Windows System Tray** (near the clock, or under the `^` arrow).
   - Your web browser opens automatically to `http://127.0.0.1:3000`.
2. **Log In:**
   - **Username:** `admin`
   - **Password:** `admin123`
   - *Change your password immediately after logging in via **Admin Dashboard → Settings**.*
3. **Close the App:** Right-click the system tray icon and select **Exit** (or double-click `stop-app.bat`).

> 💡 **Using a phone or tablet in class?** Double-click `start-internal-site.bat` instead. It will display a link (like `http://192.168.1.50:3000`) that any device connected to your classroom Wi-Fi can open.

---

## Backup & Data Safety

- Your data is stored in **`database.sqlite`** inside the app directory.
- **To back up:** Copy `database.sqlite` to a USB drive or cloud storage, or click **Backup Database** in the Admin Dashboard.
- **To restore:** Place your saved `database.sqlite` back into the app directory.

---

## For Developers & Linux/macOS Users

If you want to run from source code or host on a server:

### Run from Source (Node.js)

**Prerequisites:** Node.js 18 or newer.

```bash
# 1. Clone the repository
git clone https://github.com/richiesamlie/LocalAttendace-Final.git
cd LocalAttendace-Final

# 2. Install dependencies
npm install

# 3. Start development server (with hot reload)
npm run dev

# Or build and run production server
npm run build
npm start
```

### Run with Docker (Linux Server / NAS)

```bash
# 1. Generate environment file
bash setup-env.sh

# 2. Start container
docker-compose up -d
```

The app will be available at `http://localhost:3000`. Data is stored in the Docker volume `teacher-assistant-data`.

---

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Zustand, React Query
- **Backend:** Express, better-sqlite3 (SQLite) or optional PostgreSQL
- **Desktop:** Native C# System Tray runner (`TeacherAssistant.exe`), NSIS installer
- **Security:** bcrypt password hashing (cost 12), JWT with rotating refresh tokens, Helmet CSP, and rate limiting (150 login / 500 write requests per 15min)

---

## Documentation

| Guide | Description |
|---|---|
| [User Guide](docs/user-guide.md) | Full tutorial on classes, attendance, grading, and settings |
| [Troubleshooting](docs/troubleshooting.md) | Solutions for common questions, port issues, and firewall alerts |
| [Developer Guide](docs/developer-guide.md) | Coding standards, folder structure, and test commands |
| [Architecture](docs/architecture.md) | Technical architecture, data flow, and Windows packaging |
| [API Reference](docs/api-reference.md) | REST API endpoints and data schemas |
| [Operations Runbook](docs/operations.md) | CI/CD workflows, release packaging, and deployment |
| [Documentation Map](docs/documentation-map.md) | Full index of all documentation files |

---

## Ringkasan Singkat (Bahasa Indonesia)

- **Aplikasi Offline:** Bekerja 100% tanpa internet di laptop atau komputer sekolah.
- **Login Awal:** Username `admin`, Password `admin123`. Segera ganti password setelah login pertama di menu Admin Settings.
- **Backup Data:** Salin file `database.sqlite` ke flashdisk atau Google Drive untuk mencadangkan seluruh data siswa dan absensi.
- **Panduan Lengkap:** Buka [User Guide](docs/user-guide.md) untuk panduan langkah demi langkah.

---

## License

For educational and personal use.
