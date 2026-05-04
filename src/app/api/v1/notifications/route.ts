// src/app/api/v1/notifications/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getUserIdFromSession } from '@/app/actions';
import { UserNotificationsService } from '../../../../lib/notifications/user-notifications.service';

export const dynamic = 'force-dynamic';

// GET /api/v1/notifications - Get user notifications
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromSession();
    if (!userId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');

    const notifications = await UserNotificationsService.getUserNotifications(userId, limit);
    const unreadCount = await UserNotificationsService.getUnreadCount(userId);

    return NextResponse.json({ notifications, unreadCount });
  } catch (error: any) {
    if (error?.message?.includes('Não autorizado')) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar notificações' },
      { status: 500 }
    );
  }
}

// POST /api/v1/notifications/mark-read - Mark notification(s) as read
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromSession();
    if (!userId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const body = await request.json();
    const { notificationId, markAll } = body;

    if (markAll) {
      await UserNotificationsService.markAllAsRead(userId);
    } else if (notificationId) {
      await UserNotificationsService.markAsRead(notificationId, userId);
    } else {
      return NextResponse.json(
        { error: 'notificationId ou markAll é obrigatório' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error?.message?.includes('Não autorizado')) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    console.error('Error marking notifications as read:', error);
    return NextResponse.json(
      { error: 'Erro ao marcar notificações' },
      { status: 500 }
    );
  }
}
