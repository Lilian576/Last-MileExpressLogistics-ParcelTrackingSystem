import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { TransitionEvent } from '../state-machine/state-machine.types';

export class UpdateParcelStatusDto {
  @IsEnum(TransitionEvent)
  event: TransitionEvent;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  hubId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  deliveryProofRef?: string;
}
