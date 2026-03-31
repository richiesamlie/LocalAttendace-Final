# Teacher Assistant - User Guide

## Quick Start Guide for Beginners

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Installation](#2-installation)
3. [First Login](#3-first-login)
4. [Creating Your First Class](#4-creating-your-first-class)
5. [Adding Students](#5-adding-students)
6. [Taking Attendance](#6-taking-attendance)
7. [Inviting Other Teachers](#7-inviting-other-teachers)
8. [Viewing Reports](#8-viewing-reports)
9. [Backup & Restore](#9-backup--restore)
10. [Windows Auto-Start](#10-windows-auto-start)
11. [Troubleshooting](#11-troubleshooting)
12. [Keyboard Shortcuts](#12-keyboard-shortcuts)

---

## 1. Introduction

**Teacher Assistant** is a free, offline-first application designed to help teachers manage their classrooms efficiently. It works entirely on your computer—no internet required after installation.

### What You Can Do:
- ✅ Track daily attendance
- ✅ Manage student rosters
- ✅ Generate attendance reports
- ✅ Share classes with other teachers
- ✅ Create seating charts
- ✅ Schedule timetables
- ✅ Export data to Excel

### System Requirements:
- Windows 10 or later
- 2GB RAM minimum
- 500MB free disk space

---

## 2. Installation

### Step 1: Download the App
1. Download the ZIP file from: `https://github.com/richiesamlie/LocalAttendace-Final`
2. Click the green **Code** button → **Download ZIP**
3. Extract the ZIP to a folder (e.g., `C:\TeacherAssistant`)

### Step 2: Install Node.js
1. Go to `https://nodejs.org`
2. Download the **LTS version** (recommended)
3. Run the installer and click **Next** through all steps
4. Restart your computer after installation

### Step 3: Install Dependencies
1. Open the extracted folder
2. Double-click `start-app.bat`
3. A black window will appear and automatically install required files
4. Wait until you see "Teacher Assistant Server Started"

> **Note:** This only happens once. Future starts will be instant.

---

## 3. First Login

### Step 1: Open the App
After starting, your browser will automatically open to:
```
http://127.0.0.1:3000
```

### Step 2: Log In
Use these default credentials:
- **Username:** `admin`
- **Password:** `teacher123`

> ⚠️ **Important:** Change your password immediately after first login!

### Step 3: Change Your Password
1. Click **Admin Dashboard** in the left sidebar
2. Scroll to **Change Admin Password**
3. Enter a new password and confirm
4. Click **Update**

---

## 4. Creating Your First Class

### Method 1: Quick Create
1. Look at the top-left of the sidebar
2. Click the **⚙️ gear icon** next to "Current Class"
3. Type a class name (e.g., "Grade 5A")
4. Click the **+** button

### Method 2: Switch Between Classes
1. Click the dropdown under "Current Class"
2. Select any class to switch to it
3. All data (students, attendance) is class-specific

> 💡 **Tip:** You can rename or delete classes from the edit mode (gear icon).

---

## 5. Adding Students

### Method 1: Add Manually
1. Click **Student Roster** in the sidebar
2. Click **+ Add Student**
3. Fill in the details:
   - **Roll Number:** Student ID or number
   - **Name:** Full name
   - **Parent Name:** Optional
   - **Parent Phone:** Optional
4. Click the **✓ checkmark** to save

### Method 2: Import from Excel (Recommended for Large Classes)
1. Click **Student Roster**
2. Click **Excel Tools** → **Download Template**
3. Open the downloaded template in Excel
4. Fill in your students (one per row)
5. Save the file
6. Click **Excel Tools** → **Import from Excel**
7. Select your file

> 💡 **Tip:** Roll numbers must be unique. The app will update existing students if roll numbers match.

### Flagging Students
- Click the **🚩 flag icon** next to a student to mark them
- Flagged students are highlighted in red
- Useful for students needing special attention

### Bulk Delete Students
1. Click the **checkboxes** next to students you want to delete
2. Click **Select All** (top checkbox) to select everyone
3. Click the red **Delete** button
4. Confirm the deletion

---

## 6. Taking Attendance

### Daily Attendance
1. Click **Take Attendance** in the sidebar
2. The date defaults to today
3. For each student, click one of:
   - ✅ **Present** (green)
   - ❌ **Absent** (red)
   - 🤒 **Sick** (amber)
   - ⏰ **Late** (orange)
4. Add a reason if absent/sick/late

### Quick Actions
- **Mark All Present:** Click the button at the top-right
- **Undo Last:** Click to reverse your last attendance change
- **Search:** Type in the search box to find students quickly

### Past Attendance
1. Click **Past Data** tab
2. Select a date from the calendar
3. View or edit previous records

### Import Attendance from Excel
1. Click **Import Excel** button
2. Select an Excel file with columns:
   - Roll Number (or Student Name)
   - Date (YYYY-MM-DD format)
   - Status (Present/Absent/Sick/Late)
   - Reason (optional)

---

## 7. Inviting Other Teachers

### How Class Sharing Works
- **Owner:** Creates the class, has full control
- **Teacher:** Can view and edit class data, cannot delete class

### Add a Teacher to Your Class
1. Click **Dashboard** in the sidebar
2. Click **Manage Teachers** button (top-right)
3. A panel slides in from the right
4. Click the **Add Teacher** tab
5. Search for the teacher by name or username
6. Click **Add** next to their name

### Remove a Teacher
1. Open **Manage Teachers**
2. Click the **Current** tab
3. Click **Remove** next to the teacher
4. Only the class owner can remove teachers

### Create New Teacher Accounts
1. Go to **Admin Dashboard**
2. Click the **Teachers** tab
3. Click **Add New Teacher**
4. Fill in:
   - Username (for login)
   - Display Name
   - Password
5. Click **Create Teacher**

### Bulk Add Teachers
1. In Admin Dashboard → Teachers tab
2. Use the bulk add form
3. Enter one teacher per line: `username,Name`
4. Example:
   ```
   johnsmith,John Smith
   janedoe,Jane Doe
   ```

---

## 8. Viewing Reports

### Monthly Attendance Report
1. Click **Monthly Reports** in the sidebar
2. Select the month and year
3. The report shows:
   - Each student's daily attendance
   - Total present/absent/sick/late days
   - Attendance percentage
4. Click **Export to Excel** to download

### Export Options
- **Include Roll Number:** Check to add roll numbers
- **Include Parent Info:** Check for parent names/phones
- **Include Summary:** Check for totals and percentages

### Export Full Class Data
1. Go to **Student Roster**
2. Click **Export Class**
3. Downloads an Excel file with:
   - Students sheet
   - Attendance sheet
   - Events sheet
   - Timetable sheet
   - Daily Notes sheet

---

## 9. Backup & Restore

### Manual Backup
1. Go to **Settings & Backup**
2. Scroll to **Manual Database Backup**
3. Click **Download Backup**
4. Save the `.sqlite` file to a safe location

> 💡 **Tip:** Back up weekly or before major changes.

### Restore from Backup
1. Go to **Settings & Backup**
2. Click **Choose File** under Restore
3. Select your `.sqlite` backup file
4. Click **Restore Database**
5. The app will reload with your restored data

### Cloud Sync (Optional)
1. Move the entire app folder to your Google Drive/Dropbox
2. The database file syncs automatically
3. Access from any computer with the folder synced

---

## 10. Windows Auto-Start

### Set Up Auto-Start
1. Open the app folder
2. Double-click `setup-windows-startup.bat`
3. A confirmation message will appear
4. The app will now start automatically when you log in

### Remove Auto-Start
1. Press `Windows + R`
2. Type `shell:startup` and press Enter
3. Delete `TeacherAssistantStartup.vbs`

---

## 11. Troubleshooting

### App Won't Start
**Problem:** Black window closes immediately
**Solution:**
1. Open Command Prompt
2. Navigate to the app folder: `cd C:\TeacherAssistant`
3. Run: `npm run dev`
4. Read the error message

### "Invalid username or password"
**Solution:**
1. Default login is `admin` / `teacher123`
2. If you forgot your password, delete `database.sqlite` (WARNING: loses all data)
3. Restart the app to create a fresh database

### App Runs Slowly
**Solution:**
1. Close other browser tabs
2. Restart the app
3. Clear browser cache (Ctrl+Shift+Delete)

### "Server Offline" Message
**Solution:**
1. Check if the black server window is still open
2. If closed, double-click `start-app.bat` again
3. Wait 5 seconds for the server to start

### Database File Missing
**Solution:**
1. The database is created automatically on first run
2. If deleted, all data is lost
3. Restore from backup if available

---

## 12. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + /` | Focus search box |
| `Escape` | Close modals/panels |
| `Enter` | Save form / Confirm action |
| `Tab` | Navigate between fields |

---

## Need Help?

- **GitHub Issues:** `https://github.com/richiesamlie/LocalAttendace-Final/issues`
- **Default Login:** username: `admin`, password: `teacher123`
- **Data Location:** `database.sqlite` in the app folder

---

*Last Updated: 2026 | Version: 2.0*
