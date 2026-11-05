// Giả lập GPS của tài xế: gửi vị trí di chuyển dần từ điểm A tới B qua WebSocket.
// Cách dùng:
//   node scripts/gps-simulator.js --token <JWT shipper> --code PCL123 [--url http://localhost:3000]
//        [--from 10.7769,106.7009] [--to 10.8231,106.6297] [--steps 20] [--interval 2000]
// Shipper phải đang được giao đơn <code> (assignment assigned/accepted/in_progress).
const { io } = require('socket.io-client');

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith('--')) acc.push([cur.slice(2), arr[i + 1]]);
    return acc;
  }, []),
);
const url = args.url || 'http://localhost:3000';
const token = args.token;
const code = args.code;
if (!token || !code) {
  console.error('Thiếu --token hoặc --code');
  process.exit(1);
}
const parse = (v, d) => (v || d).split(',').map(Number);
const [lat1, lng1] = parse(args.from, '10.7769,106.7009');
const [lat2, lng2] = parse(args.to, '10.8231,106.6297');
const steps = Number(args.steps || 20);
const interval = Number(args.interval || 2000);

const socket = io(url, { transports: ['websocket'], auth: { token } });
let i = 0;
let timer;

socket.on('connect', () => {
  console.log('Đã kết nối', socket.id);
  clearInterval(timer);
  timer = setInterval(async () => {
    const t = Math.min(i / steps, 1);
    const lat = lat1 + (lat2 - lat1) * t;
    const lng = lng1 + (lng2 - lng1) * t;
    const res = await socket.emitWithAck('driver:location', {
      trackingCode: code,
      lat,
      lng,
    });
    console.log(`#${i} ${lat.toFixed(5)},${lng.toFixed(5)} ->`, res);
    if (!res.ok || i >= steps) {
      clearInterval(timer);
      socket.close();
    }
    i += 1;
  }, interval);
});
socket.on('connect_error', (e) => console.error('Lỗi kết nối:', e.message));
