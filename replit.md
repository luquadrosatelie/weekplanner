# Planejador Semanal - Weekly Task Planner

## Overview

This is a web-based weekly task planner application built with Flask (Python backend) and vanilla JavaScript (frontend). The application allows users to create, manage, and schedule tasks throughout the week with support for both offline and online modes through Firebase integration.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Backend Architecture
- **Framework**: Flask (Python)
- **Server Configuration**: Simple WSGI server running on port 5000
- **Session Management**: Flask sessions with configurable secret key
- **Logging**: Python's built-in logging module configured for debug level

### Frontend Architecture
- **Framework**: Vanilla JavaScript with ES6 modules
- **UI Framework**: Bootstrap 5.3.0 for styling and responsive design
- **Icons**: Bootstrap Icons 1.10.0
- **Language**: Portuguese (pt-BR) as primary language
- **Module System**: ES6 imports/exports for code organization

### Authentication System
- **Provider**: Firebase Authentication with Google OAuth
- **Fallback**: Offline mode for users who don't want to authenticate
- **State Management**: Firebase onAuthStateChanged for session persistence

### Data Storage
- **Online Storage**: Firebase Firestore for cloud synchronization
- **Offline Storage**: Browser localStorage for offline functionality
- **Migration Strategy**: Automatic migration from localStorage to Firestore upon login

## Key Components

### 1. Task Management System
- **Task Creation**: Modal-based task creation with categories and priorities
- **Task Properties**: Title, description, category (work/personal/health/education/other), priority (high/medium/low)
- **Task Scheduling**: Drag-and-drop interface for scheduling tasks on weekly grid
- **Task Operations**: Edit, delete, copy, and paste functionality

### 2. Weekly Grid Interface
- **Time Slots**: 20-minute intervals from 8 AM to 12 AM (midnight)
- **Days**: Sunday through Saturday
- **Visual Features**: Current time indicator (needle), hover effects, responsive design
- **Interaction**: Click-to-schedule, drag-to-move, resize capabilities

### 3. User Interface Features
- **Sidebar**: Collapsible task list with search and filter capabilities
- **Theme Support**: Light/dark mode toggle with CSS custom properties
- **Responsive Design**: Mobile-friendly layout with Bootstrap grid system
- **Copy Mode**: Special mode for duplicating scheduled tasks across time slots

### 4. Data Synchronization
- **Real-time Sync**: Automatic synchronization with Firestore when online
- **Conflict Resolution**: Last-write-wins strategy for concurrent updates
- **Batch Operations**: Efficient batch writes for multiple task operations
- **Error Handling**: Graceful degradation when Firebase is unavailable

## Data Flow

### Task Creation Flow
1. User clicks "Add Task" button
2. Modal opens with task creation form
3. User fills in task details (title, category, priority)
4. Task is added to local state and persisted to storage
5. If online, task is synchronized to Firestore
6. UI is updated to reflect new task

### Task Scheduling Flow
1. User drags task from sidebar to time slot
2. Task position is calculated based on grid coordinates
3. Scheduled task is created with time and day information
4. Local state is updated and persisted to storage
5. If online, scheduled task is synchronized to Firestore
6. Visual feedback shows task in scheduled position

### Authentication Flow
1. User can choose to login with Google or continue offline
2. If login chosen, Firebase authentication popup opens
3. Upon successful authentication, local data is migrated to Firestore
4. User state is maintained across browser sessions
5. Sync status indicator shows current connection state

## External Dependencies

### Firebase Services
- **Firebase Auth**: User authentication with Google provider
- **Firebase Firestore**: Cloud document database for data persistence
- **Firebase SDK**: Version 11.0.2 loaded from CDN

### UI Dependencies
- **Bootstrap**: Version 5.3.0 for responsive UI components
- **Bootstrap Icons**: Version 1.10.0 for iconography
- **Google Fonts**: Segoe UI font family as primary typeface

### Environment Variables
- `FIREBASE_API_KEY`: Firebase project API key
- `FIREBASE_PROJECT_ID`: Firebase project identifier
- `FIREBASE_APP_ID`: Firebase application identifier
- `SESSION_SECRET`: Flask session encryption key

## Deployment Strategy

### Development Environment
- Flask development server with debug mode enabled
- Hot reload for Python code changes
- Static file serving for CSS/JS assets
- Environment variable configuration for Firebase credentials

### Production Considerations
- WSGI-compatible deployment (Gunicorn, uWSGI)
- Environment variable management for sensitive credentials
- Static file serving through CDN or reverse proxy
- HTTPS enforcement for Firebase authentication
- Error logging and monitoring integration

### Offline Capabilities
- Progressive Web App features through service worker (potential enhancement)
- Local storage fallback for all core functionality
- Graceful degradation when network is unavailable
- Data migration strategy for transitioning between offline/online modes

### Security Measures
- Firebase Authentication handles OAuth security
- Session secret key for Flask session protection
- Client-side validation with server-side fallback
- CORS configuration for API endpoints
- Input sanitization for user-generated content