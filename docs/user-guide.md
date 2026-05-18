     1|# Teacher Assistant — User Guide
     2|
     3|Catatan bahasa: Dokumen ini berbahasa Inggris sederhana agar konsisten, dengan istilah operasional yang familiar untuk pengguna Indonesia.
     4|
     5|## Quick Start Guide for Beginners
     6|
     7|## Quick Indonesian Notes
     8|
     9|- Login awal pakai akun `admin` dengan password dari `DEFAULT_ADMIN_PASSWORD` di `.env`.
    10|- Alur harian yang direkomendasikan: Student Roster -> Take Attendance -> Monthly Reports.
    11|- Untuk restore data, selalu backup dulu sebelum upload file `.sqlite`.
    12|- Jika ada error, mulai dari section Troubleshooting di dokumen ini atau `troubleshooting.md`.
    13|
    14|---
    15|
    16|## Table of Contents
    17|
    18|1. [Introduction](#1-introduction)
    19|2. [Installation](#2-installation)
    20|3. [First Login](#3-first-login)
    21|4. [Creating Your First Class](#4-creating-your-first-class)
    22|5. [Adding Students](#5-adding-students)
    23|6. [Taking Attendance](#6-taking-attendance)
    24|7. [Inviting Other Teachers](#7-inviting-other-teachers)
    25|8. [Viewing Reports](#8-viewing-reports)
    26|9. [Backup & Restore](#9-backup--restore)
    27|10. [Using PostgreSQL (Optional)](#10-using-postgresql-optional)
    28|11. [Windows Auto-Start](#11-windows-auto-start)
    29|12. [Troubleshooting](#12-troubleshooting)
    30|13. [Keyboard Shortcuts](#13-keyboard-shortcuts)
    31|
    32|---
    33|
    34|## 1. Introduction
    35|
    36|**Teacher Assistant** is a free, offline-first application designed to help teachers manage their classrooms efficiently. It works entirely on your computer—no internet required after installation.
    37|
    38|### What You Can Do:
    39|- ✅ Track daily attendance
    40|- ✅ Manage student rosters
    41|- ✅ Generate attendance reports
    42|- ✅ Share classes with other teachers
    43|- ✅ Create seating charts
    44|- ✅ Schedule timetables
    45|- ✅ Export data to Excel
    46|
    47|### System Requirements:
    48|- Windows 10 or later
    49|- 2GB RAM minimum
    50|- 500MB free disk space
    51|
    52|---
    53|
    54|## 2. Installation
    55|
    56|You have two options to install the app. Choose the one that works best for you.
    57|
    58|---
    59|
    60|### Option A: Using Docker (Recommended for Easy Setup)
    61|
    62|> **Best for:** Users who want a quick, clean installation without installing Node.js.
    63|
    64|#### Prerequisites
    65|1. Install Docker Desktop: `https://www.docker.com/products/docker-desktop/`
    66|2. Run the installer and follow the prompts
    67|3. Restart your computer after installation
    68|4. Open Docker Desktop and wait for it to show "Docker is running"
    69|
    70|#### Step 1: Download the App
    71|1. Download the ZIP file from: `https://github.com/richiesamlie/LocalAttendace-Final`
    72|2. Click the green **Code** button → **Download ZIP**
    73|3. Extract the ZIP to a folder (e.g., `C:\TeacherAssistant`)
    74|
    75|#### Step 2: Configure the App
    76|1. Open the extracted folder
    77|2. Create a new file named `.env`
    78|3. Add this line to the file:
    79|   ```
    80|   JWT_SECRET=change_this_to_a_secure_random_string
    81|   ```
    82|4. Save the file
    83|
    84|#### Step 3: Start with Docker Compose
    85|1. Open Command Prompt as Administrator
    86|2. Navigate to the app folder:
    87|   ```
    88|   cd C:\TeacherAssistant
    89|   ```
    90|3. Run:
    91|   ```
    92|   docker-compose up -d
    93|   ```
    94|4. Wait for the download and setup (first time only)
    95|5. Open your browser to: `http://127.0.0.1:3000`
    96|
    97|> **Note:** Your data is stored in the `data` folder. Never delete this folder or you'll lose your data.
    98|
    99|#### Docker Commands Reference
   100|| Command | Description |
   101||---------|-------------|
   102|| `docker-compose up -d` | Start the app |
   103|| `docker-compose down` | Stop the app |
   104|| `docker-compose logs -f` | View logs |
   105|| `docker-compose pull` | Update to latest version |
   106|
   107|---
   108|
   109|### Option B: Using Node.js (Traditional Method)
   110|
   111|> **Best for:** Users who prefer direct control and don't want to install Docker.
   112|
   113|#### Step 1: Download the App
   114|1. Download the ZIP file from: `https://github.com/richiesamlie/LocalAttendace-Final`
   115|2. Click the green **Code** button → **Download ZIP**
   116|3. Extract the ZIP to a folder (e.g., `C:\TeacherAssistant`)
   117|
   118|#### Step 2: Install Node.js
   119|1. Go to `https://nodejs.org`
   120|2. Download the **LTS version** (recommended)
   121|3. Run the installer and click **Next** through all steps
   122|4. Restart your computer after installation
   123|
   124|#### Step 3: Install Dependencies
   125|1. Open the extracted folder
   126|2. Double-click `start-app.bat` to launch the app in optimized Production Mode.
   127|   - *Optional:* To run in Debug mode instead, open a Command Prompt in the folder and type `start-app.bat --debug`
   128|3. A black window will appear and automatically install required files
   129|4. Wait until you see "Starting Teacher Assistant Server in Production Mode..."
   130|
   131|> **Note:** Installation only happens once. Future starts will be instant.
   132|
   133|---
   134|
   135|## 3. First Login
   136|
   137|### Step 1: Open the App
   138|After starting, your browser will automatically open to:
   139|```
   140|http://127.0.0.1:3000
   141|```
   142|
   143|### Step 2: Log In
   144|Use these default credentials:
   145|- **Username:** `admin`
   146|- **Password:** value of `DEFAULT_ADMIN_PASSWORD` from your `.env` (generated by setup script or set manually)
   147|
   148|> ⚠️ **Important:** Change your password immediately after first login!
   149|
   150|### Step 3: Change Your Password
   151|1. Click **Admin Dashboard** in the left sidebar
   152|2. Scroll to **Change Admin Password**
   153|3. Enter a new password and confirm
   154|4. Click **Update**
   155|
   156|---
   157|
   158|## 4. Creating Your First Class
   159|
   160|### Method 1: Quick Create
   161|1. Look at the top-left of the sidebar
   162|2. Click the **⚙️ gear icon** next to "Current Class"
   163|3. Type a class name (e.g., "Grade 5A")
   164|4. Click the **+** button
   165|
   166|### Method 2: Switch Between Classes
   167|1. Click the dropdown under "Current Class"
   168|2. Select any class to switch to it
   169|3. All data (students, attendance) is class-specific
   170|
   171|> 💡 **Tip:** You can rename or delete classes from the edit mode (gear icon).
   172|
   173|---
   174|
   175|## 5. Adding Students
   176|
   177|### Method 1: Add Manually
   178|1. Click **Student Roster** in the sidebar
   179|2. Click **+ Add Student**
   180|3. Fill in the details:
   181|   - **Roll Number:** Student ID or number
   182|   - **Name:** Full name
   183|   - **Parent Name:** Optional
   184|   - **Parent Phone:** Optional
   185|4. Click the **✓ checkmark** to save
   186|
   187|### Method 2: Import from Excel (Recommended for Large Classes)
   188|1. Click **Student Roster**
   189|2. Click **Excel Tools** → **Download Template**
   190|3. Open the downloaded template in Excel
   191|4. Fill in your students (one per row)
   192|5. Save the file
   193|6. Click **Excel Tools** → **Import from Excel**
   194|7. Select your file
   195|
   196|> 💡 **Tip:** Roll numbers must be unique. The app will update existing students if roll numbers match.
   197|
   198|### Flagging Students
   199|- Click the **🚩 flag icon** next to a student to mark them
   200|- Flagged students are highlighted in red
   201|- Useful for students needing special attention
   202|
   203|### Bulk Delete Students
   204|1. Click the **checkboxes** next to students you want to delete
   205|2. Click **Select All** (top checkbox) to select everyone
   206|3. Click the red **Delete** button
   207|4. Confirm the deletion
   208|
   209|---
   210|
   211|## 6. Taking Attendance
   212|
   213|### Daily Attendance
   214|1. Click **Take Attendance** in the sidebar
   215|2. The date defaults to today
   216|3. For each student, click one of:
   217|   - ✅ **Present** (green)
   218|   - ❌ **Absent** (red)
   219|   - 🤒 **Sick** (amber)
   220|   - ⏰ **Late** (orange)
   221|4. Add a reason if absent/sick/late
   222|
   223|### Quick Actions
   224|- **Mark All Present:** Click the button at the top-right
   225|- **Undo Last:** Click to reverse your last attendance change
   226|- **Search:** Type in the search box to find students quickly
   227|
   228|### Past Attendance
   229|1. Click **Past Data** tab
   230|2. Select a date from the calendar
   231|3. View or edit previous records
   232|
   233|### Import Attendance from Excel
   234|1. Click **Import Excel** button
   235|2. Select an Excel file with columns:
   236|   - Roll Number (or Student Name)
   237|   - Date (YYYY-MM-DD format)
   238|   - Status (Present/Absent/Sick/Late)
   239|   - Reason (optional)
   240|
   241|---
   242|
   243|## 7. Inviting Other Teachers
   244|
   245|### How Class Sharing Works
   246|- **Owner:** Creates the class, has full control
   247|- **Teacher:** Can view and edit class data, cannot delete class
   248|
   249|### Add a Teacher to Your Class
   250|1. Click **Dashboard** in the sidebar
   251|2. Click **Manage Teachers** button (top-right)
   252|3. A panel slides in from the right
   253|4. Click the **Add Teacher** tab
   254|5. Search for the teacher by name or username
   255|6. Click **Add** next to their name
   256|
   257|### Remove a Teacher
   258|1. Open **Manage Teachers**
   259|2. Click the **Current** tab
   260|3. Click **Remove** next to the teacher
   261|4. Only the class owner can remove teachers
   262|
   263|### Create New Teacher Accounts
   264|1. Go to **Admin Dashboard**
   265|2. Click the **Teachers** tab
   266|3. Click **Add New Teacher**
   267|4. Fill in:
   268|   - Username (for login)
   269|   - Display Name
   270|   - Password
   271|5. Click **Create Teacher**
   272|
   273|### Bulk Add Teachers
   274|1. In Admin Dashboard → Teachers tab
   275|2. Use the bulk add form
   276|3. Enter one teacher per line: `username,Name`
   277|4. Example:
   278|   ```
   279|   johnsmith,John Smith
   280|   janedoe,Jane Doe
   281|   ```
   282|
   283|---
   284|
   285|## 8. Viewing Reports
   286|
   287|### Monthly Attendance Report
   288|1. Click **Monthly Reports** in the sidebar
   289|2. Select the month and year
   290|3. The report shows:
   291|   - Each student's daily attendance
   292|   - Total present/absent/sick/late days
   293|   - Attendance percentage
   294|4. Click **Export to Excel** to download
   295|
   296|### Export Options
   297|- **Include Roll Number:** Check to add roll numbers
   298|- **Include Parent Info:** Check for parent names/phones
   299|- **Include Summary:** Check for totals and percentages
   300|
   301|### Export Full Class Data
   302|1. Go to **Student Roster**
   303|2. Click **Export Class**
   304|3. Downloads an Excel file with:
   305|   - Students sheet
   306|   - Attendance sheet
   307|   - Events sheet
   308|   - Timetable sheet
   309|   - Daily Notes sheet
   310|
   311|---
   312|
   313|## 9. Backup & Restore
   314|
   315|### Manual Backup
   316|1. Go to **Settings & Backup**
   317|2. Scroll to **Manual Database Backup**
   318|3. Click **Download Backup**
   319|4. Save the `.sqlite` file to a safe location
   320|
   321|> 💡 **Tip:** Back up weekly or before major changes.
   322|
   323|### Restore from Backup
   324|1. Go to **Settings & Backup**
   325|2. Click **Choose File** under Restore
   326|3. Select your `.sqlite` backup file
   327|4. Click **Restore Database**
   328|5. The app will reload with your restored data
   329|
   330|### Cloud Sync (Optional)
   331|1. Move the entire app folder to your Google Drive/Dropbox
   332|2. The database file syncs automatically
   333|3. Access from any computer with the folder synced
   334|
   335|---
   336|
   337|## 10. Using PostgreSQL (Optional)
   338|
   339|The app uses SQLite by default (no setup needed). You can switch to PostgreSQL for production or multi-user setups.
   340|
   341|### Why Use PostgreSQL?
   342|- Better for multiple users accessing simultaneously
   343|- More robust for large datasets
   344|- Standard for production environments
   345|
   346|### Quick Setup (Windows)
   347|
   348|1. **Install PostgreSQL:**
   349|   - Download from: https://www.postgresql.org/download/windows/
   350|   - During install, remember your password for user `postgres`
   351|
   352|2. **Run the setup script:**
   353|   ```cmd
   354|   bun run db:setup:postgres
   355|   ```
   356|
   357|   This will:
   358|   - Create database `teacher_assistant`
   359|   - Run the database schema
   360|   - Ask if you want to migrate existing data
   361|   - Create `.env` file with connection string
   362|
   363|3. **Start the app (Production Mode):**
   364|   ```cmd
   365|   bun run build
   366|   set NODE_ENV=production
   367|   bun run start
   368|   ```
   369|   *(To start in debug mode, just run `bun run dev` instead)*
   370|
   371|   The app will automatically detect PostgreSQL and connect.
   372|
   373|### Quick Setup (macOS/Linux)
   374|
   375|```bash
   376|# Install PostgreSQL
   377|brew install postgresql
   378|brew services start postgresql
   379|
   380|# Run setup script
   381|bun run db:setup:postgres
   382|
   383|# Start app (Production Mode)
   384|bun run build
   385|export NODE_ENV=production
   386|bun run start
   387|```
   388|
   389|*(To start in debug mode, just use `bun run dev` instead)*
   390|
   391|### Manual PostgreSQL Setup
   392|
   393|If you prefer to set it up manually:
   394|
   395|1. Create database:
   396|   ```bash
   397|   createdb teacher_assistant
   398|   ```
   399|
   400|2. Run schema:
   401|   ```bash
   402|   psql -U postgres -d teacher_assistant -f src/repositories/schema.sql
   403|   ```
   404|
   405|3. Create `.env` file:
   406|   ```env
   407|   DATABASE_URL=postgresql://postgres:***@localhost:5432/teacher_assistant
   408|   ```
   409|
   410|4. Start app: `bun run build` and `bun run start` (or `bun run dev` for debug mode)
   411|
   412|### Switch Back to SQLite
   413|
   414|Simply remove or empty the `DATABASE_URL` in `.env`:
   415|```env
   416|# DATABASE_URL=postgresql://...
   417|```
   418|
   419|Or set: `DB_TYPE=sqlite`
   420|
   421|---
   422|
   423|## 11. Windows Auto-Start
   424|
   425|### Set Up Auto-Start
   426|1. Open the app folder
   427|2. Double-click `setup-windows-startup.bat`
   428|3. A confirmation message will appear
   429|4. The app will now start automatically when you log in
   430|
   431|### Remove Auto-Start
   432|1. Press `Windows + R`
   433|2. Type `shell:startup` and press Enter
   434|3. Delete `TeacherAssistantStartup.vbs`
   435|
   436|---
   437|
   438|## 12. Troubleshooting
   439|
   440|### App Won't Start (Node.js Method)
   441|**Problem:** Black window closes immediately
   442|**Solution:**
   443|1. Open Command Prompt
   444|2. Navigate to the app folder: `cd C:\TeacherAssistant`
   445|3. Run: `start-app.bat` (or `bun run start`)
   446|4. Read the error message
   447|
   448|### App Won't Start (Docker Method)
   449|**Problem:** `docker-compose up` fails
   450|**Solution:**
   451|1. Make sure Docker Desktop is running
   452|2. Check Docker is not showing any errors
   453|3. Run: `docker-compose logs` to see detailed errors
   454|4. If port 3000 is in use, change the port in `docker-compose.yml`:
   455|   ```yaml
   456|   ports:
   457|     - "3001:3000"  # Change 3000 to any free port
   458|   ```
   459|
   460|### Docker Container Keeps Restarting
   461|**Solution:**
   462|1. Run: `docker-compose logs teacher-assistant`
   463|2. Look for error messages
   464|3. Common fix: Delete and recreate:
   465|   ```
   466|   docker-compose down
   467|   docker-compose up -d
   468|   ```
   469|
   470|### "Invalid username or password"
   471|**Solution:**
   472|1. Default login is `admin` and the password is your configured `DEFAULT_ADMIN_PASSWORD`
   473|2. If you forgot your password, delete `database.sqlite` (WARNING: loses all data)
   474|3. Restart the app to create a fresh database
   475|
   476|### App Runs Slowly
   477|**Solution:**
   478|1. Close other browser tabs
   479|2. Restart the app
   480|3. Clear browser cache (Ctrl+Shift+Delete)
   481|
   482|### "Server Offline" Message
   483|**Solution:**
   484|1. Check if the black server window is still open
   485|2. If closed, double-click `start-app.bat` again
   486|3. Wait 5 seconds for the server to start
   487|
   488|### Database File Missing
   489|**Solution:**
   490|1. The database is created automatically on first run
   491|2. If deleted, all data is lost
   492|3. Restore from backup if available
   493|
   494|### Docker: Data Lost After Restart
   495|**Solution:**
   496|1. Make sure the `data` folder exists in your app directory
   497|2. Check `docker-compose.yml` has this volume mapping:
   498|   ```yaml
   499|   volumes:
   500|     - ./data:/app/data
   501|