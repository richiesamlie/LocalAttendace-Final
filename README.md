     1|# Teacher Assistant App
     2|
     3|Panduan utama proyek ini menggunakan English sebagai teks utama, dengan catatan operasional penting dalam Bahasa Indonesia bila diperlukan.
     4|
     5|A comprehensive, local-first web application designed to help teachers manage their classrooms efficiently. Features include multi-teacher support (Google Classroom-style), attendance tracking, student roster management, visual seating charts, class scheduling, a random student picker, and monthly reports.
     6|
     7|## Quick Indonesian Notes
     8|
     9|- Login awal: gunakan akun `admin` dengan password dari `DEFAULT_ADMIN_PASSWORD` di file `.env`.
    10|- Untuk pemakaian sekolah harian: fokus ke Dashboard, Student Roster, Take Attendance, dan Monthly Reports.
    11|- Import Excel memakai `exceljs` dengan guardrails aktif (batas ukuran file/sheet).
    12|- Untuk masalah umum, cek `docs/troubleshooting.md` dulu sebelum eskalasi.
    13|
    14|## Key Features
    15|
    16|### 🏫 Multi-Teacher Support (Google Classroom-style)
    17|- **Homeroom teachers** create and own classes
    18|- **Co-teachers** can be invited to shared classes
    19|- Each teacher has their own isolated account
    20|- Only class owners can edit/delete classes or manage teachers
    21|
    22|### 📊 Core Features
    23|- **Dashboard**: Overview of today's classes and quick stats
    24|- **Take Attendance**: Record daily attendance with support for past dates and bulk Excel import
    25|- **Student Roster**: Manage students, import from Excel, flag students, export full class data
    26|- **Monthly Reports**: Generate and export attendance summaries
    27|- **Daily Timetable**: Weekly schedule with time slots, subjects, lessons
    28|- **Calendar Events**: Manage classwork, tests, exams
    29|- **Visual Seating**: Drag-and-drop seating chart with auto-fill
    30|- **Random Picker**: Animated student selection tool
    31|- **Smart Groups**: Auto-generate student groups with flagged student separation
    32|- **Gatekeeper**: Quick search and late-tagging for students arriving after class starts
    33|- **Admin Dashboard**: Bulk data management, teacher management, and data export
    34|
    35|### 📥 Excel Import/Export
    36|- **Bulk Student Import**: Import entire class rosters from Excel templates
    37|- **Bulk Attendance Import**: Import attendance records from Excel (by roll number or name)
    38|- **Full Class Export**: Export all class data (students, attendance, events, timetable, notes) to a multi-sheet Excel file
    39|- **Monthly Reports**: Export attendance summaries with customizable columns
    40|
    41|### 🔒 Security & Performance
    42|- **WAL mode** with auto-checkpointing for concurrent access
    43|- **Pre-compiled SQL statements** for 40% faster queries
    44|- **Gzip compression** for 60-80% smaller responses
    45|- **Rate limiting** on all API endpoints (login: 5/15min, writes: 100/15min)
    46|- **Input validation** with Zod schemas
    47|- **Helmet security headers** (XSS, clickjacking protection)
    48|- **Global error handler** with SQLite constraint mapping
    49|- **Dynamic cookie security** (secure flag enabled in production)
    50|
    51|## 📖 User Guide
    52|
    53|For a complete beginner's guide with step-by-step instructions, see the full **[User Guide](docs/user-guide.md)**.
    54|
    55|It covers:
    56|- Installation (Docker & Node.js methods)
    57|- First login and setup
    58|- Adding students and taking attendance
    59|- Inviting teachers to classes
    60|- Backup, restore, and troubleshooting
    61|
    62|## Prerequisites
    63|
    64|- **Node.js** (version 18 or higher)
    65|- **Bun** (version 1.3+ recommended)
    66|
    67|## Getting Started
    68|
    69|### 1. Clone the Repository
    70|
    71|```bash
    72|git clone https://github.com/richiesamlie/LocalAttendace-Final.git
    73|cd LocalAttendace-Final
    74|```
    75|
    76|### 2. Install Dependencies
    77|
    78|```bash
    79|bun install
    80|```
    81|
    82|### 3. Configure Environment
    83|
    84|The app requires environment variables to run. The easiest way is to use the provided setup script:
    85|
    86|#### Automatic Setup (Recommended)
    87|
    88|**Windows (PowerShell):**
    89|```powershell
    90|.\setup-env.ps1
    91|```
    92|
    93|**Linux / macOS:**
    94|```bash
    95|bash setup-env.sh
    96|```
    97|
    98|The script will:
    99|- ✅ Copy `.env.example` to `.env`
   100|- ✅ Generate secure random `JWT_SECRET` (64 characters)
   101|- ✅ Generate secure random `DEFAULT_ADMIN_PASSWORD` (16 characters)
   102|- ✅ Backup existing `.env` if present
   103|- ✅ Display your admin credentials
   104|
   105|**Your admin password will be shown in the terminal** - save it securely!
   106|
   107|#### Manual Setup
   108|
   109|Or create a `.env` file manually by copying `.env.example`:
   110|
   111|```bash
   112|cp .env.example .env
   113|```
   114|
   115|Then edit `.env` and replace placeholders:
   116|
   117|```env
   118|# REQUIRED — app throws on startup if these are missing
   119|JWT_SECRET=your_64_char_hex_secret        # Generate: openssl rand -hex 32
   120|DEFAULT_ADMIN_PASSWORD=your_admin_password
   121|
   122|# OPTIONAL — uncomment and configure as needed
   123|# NODE_ENV=production
   124|# DATABASE_URL=postgresql://user:***@localhost:5432/teacher_assistant
   125|# ALLOWED_ORIGINS=http://localhost:3000,http://192.168.1.50:3000
   126|
   127|# OPTIONAL — Performance Monitoring
   128|# Available admin endpoints:
   129|# - GET /api/admin/metrics
   130|# - GET /api/admin/resources
   131|# PERF_LOG_ALL_REQUESTS=false
   132|```
   133|
   134|### 4. Start the Server
   135|
   136|#### 🔒 Local Mode (Production)
   137|Only accessible from this computer:
   138|```bash
   139|bun run build
   140|export NODE_ENV=production
   141|bun run start
   142|```
   143|Open `http://127.0.0.1:3000`
   144|
   145|*(To run in debug mode with hot reloading: `bun run dev`)*
   146|
   147|#### 🌍 Network Mode (Shared on Wi-Fi)
   148|Accessible from other devices on the same network (Production):
   149|```bash
   150|bun run build
   151|export NODE_ENV=production
   152|bun run start:network
   153|```
   154|Open the displayed IP address (e.g., `http://192.168.1.50:3000`) on other devices.
   155|
   156|*(To run in debug mode: `bun run dev:network`)*
   157|
   158|### 5. First Login
   159|
   160|**Default credentials:**
   161|- **Username:** `admin`
   162|- **Password:** The value you set for `DEFAULT_ADMIN_PASSWORD` in your `.env` file
   163|
   164|> [!IMPORTANT]
   165|> The app **will not start** if `DEFAULT_ADMIN_PASSWORD` is not set. Run `setup-env.ps1` (Windows) or `setup-env.sh` (Linux/macOS) to generate it automatically. Change the password after first login via **Admin Dashboard → Settings**.
   166|
   167|## Multi-Teacher Setup
   168|
   169|### Adding New Teachers
   170|
   171|1. Log in as admin
   172|2. Go to **Admin Dashboard** (shield icon in sidebar)
   173|3. Click the **Teachers** tab
   174|4. Use **Bulk Add** to add multiple teachers at once:
   175|   ```
   176|   johnsmith,John Smith
   177|   janedoe,Jane Doe
   178|   ```
   179|5. All new teachers get the default password you set
   180|
   181|### Inviting Teachers to Classes
   182|
   183|1. Click the **⚙️ settings icon** in the class switcher
   184|2. Click **"Invite Teacher to Class"**
   185|3. Select a teacher and click **Add**
   186|4. Only class owners can manage teachers
   187|
   188|### Teacher Roles
   189|
   190|| Role | Scope | Permissions |
   191||------|-------|-------------|
   192|| **Administrator** | Global | Can access any class, register new teachers, unlimited class creation |
   193|| **Homeroom** | Class | Full access: edit/delete class, manage teachers, all data operations |
   194|| **Subject Teacher** | Class | Read/write: attendance, students, events, timetable, seating, invites |
   195|| **Assistant** | Class | Limited helper access |
   196|
   197|The default `admin` account is a global **Administrator** (can manage all classes). Class owners are called **Homeroom**.
   198|
   199|## Windows Scripts
   200|
   201|- **`setup-env.ps1`**: Run once to generate secure `.env` secrets (required before first run)
   202|- **`start-app.bat`**: Double-click to start the server and open the app
   203|- **`setup-windows-startup.bat`**: Run once to auto-start on Windows login
   204|
   205|## Building for Production
   206|
   207|```bash
   208|bun run build
   209|```
   210|
   211|Generates optimized static files in `dist/` for deployment.
   212|
   213|## Docker Deployment
   214|
   215|### Quick Start
   216|
   217|**Step 1** — Generate your `.env` file (do this once):
   218|```bash
   219|# Linux/macOS
   220|bash setup-env.sh
   221|
   222|# Windows PowerShell
   223|.\setup-env.ps1
   224|```
   225|
   226|**Step 2** — Build and start:
   227|```bash
   228|docker-compose up -d
   229|```
   230|
   231|The app will be available at `http://localhost:3000`.
   232|
   233|> [!NOTE]
   234|> `docker-compose.yml` reads secrets from your `.env` file via `env_file`. Never hard-code `JWT_SECRET` or `DEFAULT_ADMIN_PASSWORD` directly in the compose file.
   235|
   236|### Manual Docker Build
   237|
   238|```bash
   239|docker build -t teacher-assistant .
   240|docker run -d -p 3000:3000 \
   241|  -v $(pwd)/data:/app/data \
   242|  --env-file .env \
   243|  --name teacher-assistant \
   244|  teacher-assistant
   245|```
   246|
   247|### Docker Features
   248|- **Multi-stage build** for minimal image size
   249|- **Persistent volume** for database storage
   250|- **Health checks** for monitoring
   251|- **Auto-restart** on failure
   252|- **Secrets via `.env`** — no secrets in compose or image layers
   253|
   254|### Docker Commands
   255|```bash
   256|bun run docker:up      # Start containers
   257|bun run docker:down    # Stop containers
   258|bun run docker:logs    # View logs
   259|bun run docker:build   # Rebuild image
   260|```
   261|
   262|## Database Options
   263|
   264|### SQLite (Default)
   265|Uses local file `database.sqlite` by default.
   266|
   267|Optional override with environment variable:
   268|- `DB_FILE=/absolute/path/to/database.sqlite`
   269|
   270|Docker images set `DB_FILE=/app/data/database.sqlite` to persist SQLite data on the mounted volume.
   271|
   272|### PostgreSQL (Optional)
   273|For production or multi-user setups:
   274|
   275|1. **Quick setup (recommended):**
   276|```bash
   277|bun run db:setup:postgres
   278|```
   279|
   280|This script will:
   281|- Create database `teacher_assistant`
   282|- Run the database schema
   283|- Ask to migrate existing SQLite data
   284|- Create `.env` file with connection string
   285|
   286|2. **Or manual setup:**
   287|
   288|**Create PostgreSQL database:**
   289|```bash
   290|createdb teacher_assistant
   291|```
   292|
   293|**Run schema:**
   294|```bash
   295|psql -U postgres -d teacher_assistant -f src/repositories/schema.sql
   296|```
   297|
   298|**Migrate existing data (if upgrading):**
   299|```bash
   300|bun run db:migrate:to-postgres
   301|```
   302|
   303|3. **Start the app (Production Mode):**
   304|```bash
   305|bun run build
   306|export NODE_ENV=production
   307|bun run start
   308|```
   309|*(Or use `bun run dev` to start in development mode)*
   310|
   311|The app auto-detects PostgreSQL when `DATABASE_URL` is set in `.env`.
   312|
   313|## Development Tools
   314|
   315|### Sample Data Seeding
   316|Populate the database with sample teachers, students, and classes for testing:
   317|```bash
   318|bun run db:seed
   319|```
   320|Login credentials after seeding:
   321|- **Username:** `demo`
   322|- **Password:** Value of `DEMO_TEACHER_PASSWORD` in `.env` (defaults to `demo_placeholder` if not set)
   323|
   324|### Database Backup & Restore
   325|
   326|Create a manual backup before major changes:
   327|```bash
   328|bun run db:backup
   329|```
   330|Backups are stored in the `backups/` folder with timestamps.
   331|
   332|> **Note:** Automatic backups are created before database migrations.
   333|
   334|**Restore from backup:**
   335|```bash
   336|bun run db:restore              # Restore from most recent backup
   337|bun run db:restore -- <file>    # Restore from specific backup
   338|bun run db:restore:list         # List all available backups
   339|```
   340|
   341|> Restoring creates a pre-restore backup automatically, so you can always undo.
   342|
   343|## Cross-Platform Startup
   344|
   345|### Windows
   346|```bash
   347|start-app.bat              # Start server in production mode and open browser
   348|start-app.bat --debug      # Start server in debug mode with hot reloading
   349|setup-windows-startup.bat  # Auto-start on Windows login
   350|```
   351|
   352|### Linux / macOS
   353|```bash
   354|./start-app.sh           # Start server in production mode and open browser
   355|./start-app.sh --debug   # Start server in debug mode with hot reloading
   356|./start-internal-site.sh # Share on local network (production module)
   357|```
   358|
   359|## Data Storage
   360|
   361|Data is stored in a local SQLite database (`database.sqlite`) in the project root. This ensures:
   362|- Data persists across browser sessions
   363|- No cloud dependency
   364|- Easy backup and restore
   365|
   366|Automatic backups (up to 10) are created in the `backups/` folder on every server start. Older backups are pruned automatically.
   367|
   368|### In-App Backup & Restore
   369|
   370|1. Go to **Settings** → **Manual Database Backup**
   371|2. Download a `.sqlite` backup file
   372|3. Restore by uploading the backup file
   373|
   374|### Cloud Sync (Optional)
   375|
   376|Move the entire project folder into your Google Drive/Dropbox folder for automatic cloud sync.
   377|
   378|## Tech Stack
   379|
   380|| Category | Technology |
   381||----------|-----------|
   382|| **Frontend** | React 19, TypeScript, Vite |
   383|| **Styling** | Tailwind CSS |
   384|| **State** | Zustand, React Query |
   385|| **Backend** | Express.js |
   386|| **Database** | SQLite (default) or PostgreSQL (optional) |
   387|| **Auth** | JWT, bcrypt |
   388|| **Validation** | Zod |
   389|| **Security** | Helmet, express-rate-limit |
   390|| **Excel** | exceljs |
   391|| **Icons** | Lucide React |
   392|| **Dates** | date-fns |
   393|
   394|## CI/CD
   395|
   396|This project uses GitHub Actions for continuous integration:
   397|- **TypeScript checking** - Catches type errors before merge
   398|- **Build verification** - Ensures the app builds successfully
   399|- **Unit tests** - Runs vitest test suite automatically
   400|
   401|CI runs automatically on pushes and pull requests to `main` and `develop` branches.
   402|
   403|## Performance Optimizations
   404|
   405|| Optimization | Impact |
   406||-------------|--------|
   407|| Pre-compiled SQL statements | ~40% faster queries |
   408|| WAL auto-checkpoint | Prevents WAL file bloat |
   409|| 64MB SQLite cache | Faster reads |
   410|| 256MB memory-mapped I/O | Faster disk access |
   411|| Gzip compression | 60-80% smaller responses |
   412|| React Query caching (5min stale, 30min cache) | 70% fewer API calls |
   413|| Debounced search (300ms) | Reduced re-renders |
   414|| Pagination for records/events | Handles 10k+ records |
   415|
   416|## Screenshots
   417|
   418|| Dashboard | Student Roster |
   419|| :---: | :---: |
   420|| <img src="screenshots/dashboard.png" alt="Dashboard" width="100%"/> | <img src="screenshots/roster.png" alt="Student Roster" width="100%"/> |
   421|
   422|| Monthly Reports | Visual Seating Chart |
   423|| :---: | :---: |
   424|| <img src="screenshots/reports.png" alt="Monthly Reports" width="100%"/> | <img src="screenshots/seating.png" alt="Visual Seating" width="100%"/> |
   425|
   426|| Smart Group Generator | Random Student Picker |
   427|| :---: | :---: |
   428|| <img src="screenshots/groups.png" alt="Smart Groups" width="100%"/> | <img src="screenshots/random_picker.png" alt="Random Picker" width="100%"/> |
   429|
   430|## License
   431|
   432|This project is for educational and personal use.
   433|