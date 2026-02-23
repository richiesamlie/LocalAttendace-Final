# Teacher Assistant App

A comprehensive web application designed to help teachers manage their classrooms efficiently. Features include attendance tracking, student roster management, visual seating charts, class scheduling, a random student picker, and monthly reports.

## Prerequisites

Before you begin, ensure you have the following installed on your machine:
- **Node.js** (version 18 or higher recommended)
- **npm** (Node Package Manager, which comes with Node.js)

## Getting Started

Follow these steps to run the application locally:

### 1. Clone or Download the Repository
If you haven't already, download the source code to your local machine and navigate to the project directory in your terminal.

```bash
cd teacher-assistant
```

### 2. Install Dependencies
Run the following command to install all the required packages and dependencies:

```bash
npm install
```

### 3. Start the Development Server
Once the installation is complete, you can start the local development server:

```bash
npm run dev
```

### 4. Open the App
After running the start command, your terminal will display a local URL (usually `http://localhost:5173` or `http://localhost:3000`). Open this URL in your web browser to use the app.

## Building for Production

To create a production-ready build of the application, run:

```bash
npm run build
```
This will generate optimized static files in the `dist` directory, which can be deployed to any static hosting service (like Vercel, Netlify, or GitHub Pages).

## Features Overview

- **Dashboard**: Overview of today's classes and quick stats.
- **Take Attendance**: Record daily attendance with support for past dates.
- **Student Roster**: Manage your students, import from Excel, and flag students who need special attention.
- **Class Schedule**: Calendar view to manage classwork, tests, and exams.
- **Visual Seating**: Drag-and-drop seating chart with an auto-fill feature that respects flagged students (keeps them separated).
- **Random Picker**: Fun, animated tool to randomly select a student for participation.
- **Monthly Reports**: Generate and export attendance summaries to Excel.

## Tech Stack
- React 18
- TypeScript
- Vite
- Tailwind CSS
- Zustand (State Management)
- date-fns (Date manipulation)
- xlsx (Excel import/export)
- Lucide React (Icons)
