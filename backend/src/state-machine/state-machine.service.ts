import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { ParcelStatus } from '@prisma/client';
import { TERMINAL_STATES, TRANSITION_TABLE } from './transition-table';
import {
  TransitionActor,
  TransitionContext,
  TransitionDefinition,
  TransitionEvent,
  TransitionResult,
} from './state-machine.types';

@Injectable()
export class StateMachineService {
  /**
   * Kiểm tra 1 trạng thái có phải trạng thái cuối (terminal) không.
   * Terminal state không có transition nào đi ra.
   */
  isTerminalState(status: ParcelStatus): boolean {
    return TERMINAL_STATES.includes(status);
  }

  /**
   * Trả về danh sách các transition hợp lệ về mặt CẤU TRÚC (chưa tính guard)
   * xuất phát từ 1 trạng thái. Dùng để hiển thị "các hành động có thể làm tiếp theo".
   */
  getAvailableTransitions(from: ParcelStatus): TransitionDefinition[] {
    return TRANSITION_TABLE.filter((t) => t.from === from);
  }

  /**
   * Tìm transition khớp với (from, event) trong bảng.
   */
  private findTransition(from: ParcelStatus | null, event: TransitionEvent): TransitionDefinition | undefined {
    return TRANSITION_TABLE.find((t) => t.from === from && t.event === event);
  }

  /**
   * Kiểm tra transition có hợp lệ hay không, KHÔNG throw exception —
   * trả về object result để bên gọi tự quyết định xử lý (dùng khi cần preview/kiểm tra trước).
   */
  validateTransition(
    from: ParcelStatus | null,
    event: TransitionEvent,
    actor: TransitionActor,
    context: TransitionContext = {},
  ): TransitionResult {
    const transition = this.findTransition(from, event);

    if (!transition) {
      return {
        valid: false,
        reason: `Không tồn tại transition từ trạng thái '${from ?? '(khởi tạo)'}' với event '${event}'`,
      };
    }

    if (from !== null && this.isTerminalState(from)) {
      return {
        valid: false,
        reason: `Trạng thái '${from}' là trạng thái cuối (terminal), không thể chuyển tiếp`,
      };
    }

    if (!transition.allowedActors.includes(actor)) {
      return {
        valid: false,
        reason: `Actor '${actor}' không được phép thực hiện event '${event}'. Chỉ cho phép: ${transition.allowedActors.join(', ')}`,
      };
    }

    if (!transition.guard(context)) {
      return {
        valid: false,
        reason: `Điều kiện không thỏa mãn: ${transition.guardDescription}`,
      };
    }

    return { valid: true, toStatus: transition.to, matchedTransition: transition };
  }

  /**
   * Giống validateTransition, nhưng THROW exception nếu không hợp lệ.
   * Dùng trực tiếp trong API PATCH status của ParcelsModule (M2).
   *
   * @throws BadRequestException nếu transition không tồn tại / guard không thỏa mãn
   * @throws ForbiddenException nếu actor không có quyền thực hiện event này
   */
  assertTransition(
    from: ParcelStatus | null,
    event: TransitionEvent,
    actor: TransitionActor,
    context: TransitionContext = {},
  ): ParcelStatus {
    const result = this.validateTransition(from, event, actor, context);

    if (!result.valid) {
      const transitionExists = !!this.findTransition(from, event);
      const isActorIssue = transitionExists && !this.findTransition(from, event)!.allowedActors.includes(actor);

      if (isActorIssue) {
        throw new ForbiddenException(result.reason);
      }
      throw new BadRequestException(result.reason);
    }

    return result.toStatus as ParcelStatus;
  }

  /**
   * Trả về mô tả side-effect cần thực hiện khi transition thành công.
   * ParcelsService (M2) dùng thông tin này để biết cần làm thêm gì
   * (vd: tạo delivery_assignments, tăng failed_attempt_count...) sau khi cập nhật status.
   */
  getSideEffectDescription(from: ParcelStatus | null, event: TransitionEvent): string | undefined {
    return this.findTransition(from, event)?.sideEffect;
  }
}
