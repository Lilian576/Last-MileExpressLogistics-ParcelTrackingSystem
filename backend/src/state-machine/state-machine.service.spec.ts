import { describe, it, expect, beforeEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { StateMachineService } from './state-machine.service';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { TransitionEvent, TransitionContext } from './state-machine.types';
import { ParcelStatus } from '@prisma/client';


describe('StateMachineService', () => {
  let service: StateMachineService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StateMachineService],
    }).compile();
    service = module.get<StateMachineService>(StateMachineService);
  });

  // Nhóm 1: Kiểm thử Utility Functions
  it('1. isTerminalState trả về true cho trạng thái DELIVERED', () => {
    expect(service.isTerminalState(ParcelStatus.DELIVERED)).toBe(true);
  });

  it('2. isTerminalState trả về false cho trạng thái CREATED', () => {
    expect(service.isTerminalState(ParcelStatus.CREATED)).toBe(false);
  });

  it('3. getAvailableTransitions trả về mảng hợp lệ', () => {
    const transitions = service.getAvailableTransitions(ParcelStatus.CREATED);
    expect(Array.isArray(transitions)).toBe(true);
  });

  // Nhóm 2: Kiểm thử validateTransition (Trả về object kết quả)
  it('4. validateTransition thất bại nếu event không tồn tại', () => {
    // Dùng ép kiểu để giả lập event rác
    const result = service.validateTransition(ParcelStatus.CREATED, ('FAKE_EVENT' as unknown) as TransitionEvent, 'dispatcher');
    expect(result.valid).toBe(false);
  });

  it('5. validateTransition thất bại nếu chuyển từ Terminal State', () => {
    const result = service.validateTransition(ParcelStatus.DELIVERED, TransitionEvent.ASSIGN_COURIER, 'dispatcher');
    expect(result.valid).toBe(false);
  });

  it('6. validateTransition thất bại nếu sai Actor (Khách hàng không thể assign shipper)', () => {
    const result = service.validateTransition(ParcelStatus.CREATED, TransitionEvent.ASSIGN_COURIER, 'customer');
    expect(result.valid).toBe(false);
  });

  it('7. validateTransition thất bại nếu Guard Condition không thỏa (Không có shipper khả dụng)', () => {
    const context: TransitionContext = { hasAvailableCourier: false };
    const result = service.validateTransition(ParcelStatus.CREATED, TransitionEvent.ASSIGN_COURIER, 'dispatcher', context);
    expect(result.valid).toBe(false);
  });

  // Nhóm 3: Kiểm thử assertTransition (Ném Exception)
  it('8. assertTransition ném BadRequestException nếu sai luồng', () => {
    expect(() => {
      service.assertTransition(ParcelStatus.CREATED, TransitionEvent.CONFIRM_DELIVERY, 'shipper');
    }).toThrow(BadRequestException);
  });

  it('9. assertTransition ném ForbiddenException nếu sai Actor', () => {
    expect(() => {
      service.assertTransition(ParcelStatus.CREATED, TransitionEvent.ASSIGN_COURIER, 'customer');
    }).toThrow(ForbiddenException); // Phải là dispatcher hoặc system
  });

  it('10. assertTransition ném BadRequestException nếu bắt đầu từ Terminal State', () => {
    expect(() => {
      service.assertTransition(ParcelStatus.DELIVERED, TransitionEvent.CONFIRM_PICKUP, 'shipper');
    }).toThrow(BadRequestException);
  });

  it('11. assertTransition thành công (Happy Path) khi thỏa mãn mọi điều kiện', () => {
    const context: TransitionContext = { hasAvailableCourier: true };
    const nextState = service.assertTransition(
      ParcelStatus.CREATED, 
      TransitionEvent.ASSIGN_COURIER, 
      'dispatcher', 
      context
    );
    expect(nextState).toBeDefined();
  });
});