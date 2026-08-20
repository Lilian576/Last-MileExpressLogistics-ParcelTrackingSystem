import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*' },
})
export class TrackingGateway {
  @WebSocketServer()
  server: Server;

  @SubscribeMessage('ping')
  handlePing(
    @MessageBody() data: string,
    @ConnectedSocket() client: Socket,
  ) {
    console.log('Nhận được ping:', data);
    client.emit('pong', 'pong tu server'); // gửi thẳng lại cho đúng client vừa gửi
  }
}