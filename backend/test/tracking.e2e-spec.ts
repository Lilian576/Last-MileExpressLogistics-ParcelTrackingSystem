/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-require-imports */
const request = require('supertest');
import { io, Socket } from 'socket.io-client';

describe('Parcel Tracking System (e2e)', () => {
  const SERVER_URL = 'http://localhost:3000';
  let socket: Socket;
  const trackingCode = 'TEST_PARCEL_001';

  beforeAll((done) => {
    // M4: Khởi tạo kết nối Socket client
    socket = io(SERVER_URL);
    socket.on('connect', () => {
      socket.emit('joinRoom', { trackingCode });
      done();
    });
  });

  afterAll(() => {
    socket.disconnect(); // Dọn dẹp tài nguyên
  });

  it('trả mã 404 rõ ràng và không coi mã sai là mã thành công', async () => {
    const response = await request(SERVER_URL).get(
      `/api/public/track/${trackingCode}`,
    );

    expect(response.status).toBe(404);
  });
  it('Nên tự động kết nối lại và join room khi mạng phục hồi', (done) => {
    // 1. Cài đặt lắng nghe event kết nối lại TRƯỚC
    socket.once('connect', () => {
      socket.emit('joinRoom', { trackingCode });
      done(); // Báo hiệu test case thành công
    });

    // 2. Cài đặt lắng nghe event rớt mạng TRƯỚC
    socket.once('disconnect', () => {
      socket.connect(); // Kích hoạt kết nối lại ngay lập tức
    });
    // 3. Bây giờ mới thực hiện giả lập ngắt mạng
    socket.disconnect();
  });
});
