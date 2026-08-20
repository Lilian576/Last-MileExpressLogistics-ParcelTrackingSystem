interface PricingInput {
    weightKg: number;
    senderLat: number;
    senderLng: number;
    receiverLat: number;
    receiverLng: number;
}
export declare class ParcelsService {
    private readonly BASE_FEE;
    private readonly PRICE_PER_KG;
    private readonly PRICE_PER_KM;
    calculateFee(input: PricingInput): number;
    private calculateDistance;
    private toRad;
}
export {};
