import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

export type SignalingHandshakePayload = {
  id: string;
  target: string;
  targetSocketId: string;
  sdp: RTCSessionDescriptionInit;
};
export type SignalingIceCandidatePayload = {
  id: string;
  target: string;
  targetSocketId: string;
  candidate: RTCIceCandidateInit;
};

@WebSocketGateway({
  cors: {
    methods: ['GET', 'POST'],
  },
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  connections: Map<string, any> = new Map<string, any>();

  @WebSocketServer() wss: Server;
  private logger: Logger = new Logger('EventsGateway');

  afterInit(): any {
    this.logger.log('Initialized on :');
  }

  handleConnection(client: Socket): any {
    this.logger.log('Client connected: ' + client.id);
  }

  handleDisconnect(client: Socket): any {
    this.logger.log('Client disconnected: ' + client.id);
  }

  @SubscribeMessage('disconnecting')
  handleDisconnecting(client: Socket): any {
    this.logger.log('Client disconnected: ' + client.id);
    const connection = this.connections.get(client.id);
    if (connection) {
      this.wss.to(connection.meetingId).emit('memberDisconnect', {
        socketId: client.id,
        meetingMemberId: connection.meetingMemberId,
      });
      this.connections.delete(client.id);
    }
  }

  //WEB APP MEETING HANDLING

  @SubscribeMessage('joinMeeting')
  handleJoinMeeting(
    client: Socket,
    payload: {
      meetingMemberId: string;
      meetingId: string;
    },
  ): any {
    client.join(payload.meetingId);
    this.connections.set(client.id, {
      meetingMemberId: payload.meetingMemberId,
      meetingId: payload.meetingId,
    });
  }

  @SubscribeMessage('initReceive')
  handleInitReceive(
    client: Socket,
    payload: {
      meetingMemberId: string;
      meetingId: string;
    },
  ): any {
    const member = this.connections.get(payload.meetingMemberId);
    if (!member) {
      client.join(payload.meetingId);
      this.connections.set(client.id, {
        meetingMemberId: payload.meetingMemberId,
        meetingId: payload.meetingId,
      });
    }
    client
      .to(payload.meetingId)
      .emit('initReceive', { ...payload, socketId: client.id });
  }

  @SubscribeMessage('initSend')
  handleInitSend(
    client: Socket,
    payload: {
      socketId: string;
      meetingMemberId: string;
    },
  ): any {
    const connection = this.connections.get(client.id);
    if (connection) {
      client.to(payload.socketId).emit('initSend', {
        srcSocketId: client.id,
        srcMeetingMember: connection.meetingMemberId,
      });
    }
  }

  @SubscribeMessage('offer')
  handleOffer(client: Socket, payload: SignalingHandshakePayload): any {
    const connection = this.connections.get(payload.targetSocketId);
    if (connection.meetingMemberId) {
      client
        .to(payload.targetSocketId)
        .emit('offer', { meetingMemberId: payload.id, sdp: payload.sdp });
    }
  }

  @SubscribeMessage('answer')
  handleAnswer(client: Socket, payload: SignalingHandshakePayload): any {
    const connection = this.connections.get(payload.targetSocketId);
    if (connection.meetingMemberId) {
      client
        .to(payload.targetSocketId)
        .emit('answer', { meetingMemberId: payload.id, sdp: payload.sdp });
    }
  }

  @SubscribeMessage('iceCandidate')
  handleIceCandidate(
    client: Socket,
    payload: SignalingIceCandidatePayload,
  ): any {
    const connection = this.connections.get(payload.targetSocketId);
    if (connection.meetingMemberId) {
      client.to(payload.targetSocketId).emit('iceCandidate', {
        meetingMemberId: payload.id,
        candidate: payload.candidate,
      });
    } else {
      this.logger.error('NO SOCKET FOUND FOR ID ', payload);
    }
  }
}
