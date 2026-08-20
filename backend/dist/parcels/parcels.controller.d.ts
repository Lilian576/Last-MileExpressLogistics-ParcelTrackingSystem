import { ParcelsService } from './parcels.service';
interface CalculateFeeDto {
    weightKg: number;
    senderLat: number;
    senderLng: number;
    receiverLat: number;
    receiverLng: number;
}
export declare class ParcelsController {
    private readonly parcelsService;
    constructor(parcelsService: ParcelsService);
    calculateFee(dto: CalculateFeeDto): {
        fee: number;
        currency: string;
        details: {
            weightKg: number;
        };
    };
}
export {};
