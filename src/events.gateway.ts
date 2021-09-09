import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Socket, Server } from 'socket.io';
import { WsGuard } from './auth/guards/ws-guard.guard';
import { Participant } from './model/participant.model';

@WebSocketGateway({
  cors: {
    methods: ['GET', 'POST'],
  },
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private participants: Map<string, Participant> = new Map<
    string,
    Participant
  >();
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

  @UseGuards(WsGuard)
  @SubscribeMessage('disconnecting')
  handleDisconnecting(client: Socket): any {
    this.logger.log('Client disconnected: ' + client.id);
    if (this.participants.has(client.id)) {
      const participant = this.participants.get(client.id);
      this.logger.log('Broadcasting to meeting: ' + participant.meetingId);
      this.wss.to(participant.meetingId).emit('participant-disconnected', {
        id: participant.id,
        sender: client.id,
      });
      this.participants.delete(client.id);
    }
  }

  //WEB APP MEETING HANDLING
  @UseGuards(WsGuard)
  @SubscribeMessage('join-meeting')
  handleJoinMeeting(client: Socket, payload: any): any {
    this.participants.set(client.id, {
      id: payload.id,
      alias: payload.alias,
      socketId: client.id,
      meetingId: payload.roomId,
      isMeetingCreator: payload.isMeetingCreator,
    });
    // console.log('PARTICIPANT JOINS ROOM => ' + payload.roomId);
    this.wss.to(payload.roomId).emit('join-meeting', {
      id: payload.id,
      alias: payload.alias,
      socketId: client.id,
    });
    client.join(payload.roomId);
  }

  @UseGuards(WsGuard)
  @SubscribeMessage('end-meeting-session')
  handleEndMeetingSession(client: Socket, payload: any): any {
    console.log('end-meeting-session', payload);
    console.log(client.rooms)
    const participant = this.participants.get(payload.id);
    this.wss.to(payload.roomId).emit('end-meeting-session', {
      msg: 'end-meeting',
    });
    // if (participant && participant.isMeetingCreator) {
    //   this.wss.to(payload.roomId).emit('end-meeting-session', {
    //     msg: 'end-meeting',
    //   });
    // }
  }

  // WEBRTC HANDSHAKE
  @UseGuards(WsGuard)
  @SubscribeMessage('offer')
  handleOffer(client: Socket, payload): any {
    console.log('offer');
    this.wss
      .to(payload.target)
      .emit('offer', { id: payload.id, sender: client.id, sdp: payload.sdp });
  }

  @UseGuards(WsGuard)
  @SubscribeMessage('answer')
  handleAnswer(client: Socket, payload): any {
    console.log('answer');
    this.wss
      .to(payload.target)
      .emit('answer', { id: payload.id, sender: client.id, sdp: payload.sdp });
  }

  @UseGuards(WsGuard)
  @SubscribeMessage('ice-candidate')
  handleIceCandidate(client: Socket, payload): any {
    console.log('ice-candidate', payload);
    this.wss.to(payload.target).emit('ice-candidate', {
      id: payload.id,
      sender: client.id,
      candidate: payload.candidate,
    });
  }
}
