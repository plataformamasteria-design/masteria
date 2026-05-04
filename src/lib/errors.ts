export class AppError extends Error { constructor(public code: string, message: string, public cause?: unknown){ super(message); this.name = code } }
export class ApiError extends AppError { constructor(status: number, message: string, cause?: unknown){ super(`API_${status}`, message, cause) ; this.status = status } status: number }
export class DatabaseError extends AppError {}