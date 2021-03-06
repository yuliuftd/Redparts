// react
import { useEffect, useRef, useState } from 'react';
// third-party
import { useIntl } from 'react-intl';
// application
import { IVehicle } from '~/interfaces/vehicle';
import { vehicleApi } from '~/api';

interface VehicleSelectItemDef<T = any> {
    key: string;
    label: string;
    placeholder: string;
    optionsSource: (...args: any[]) => Promise<T[]>;
    serializeOptionFn?: (option: T, item: VehicleSelectItem<T>) => string;
    deserializeOptionFn?: (value: string, item: VehicleSelectItem<T>) => T;
}

interface VehicleSelectItem<T = any> extends VehicleSelectItemDef<T> {
    value: string | number;
    loading: boolean;
    options: T[];
    disabled: boolean,
}

function makeItems(itemsDef: VehicleSelectItemDef[]): VehicleSelectItem[] {
    return itemsDef.map((itemDef, index) => ({
        ...itemDef,
        value: 'none',
        loading: false,
        options: [],
        disabled: index !== 0,
    }));
}

function getItemValue(item: VehicleSelectItem): any {
    const { value: itemValue } = item;

    if (itemValue !== 'none' && item.deserializeOptionFn) {
        return item.deserializeOptionFn(itemValue, item);
    }

    return itemValue;
}

function getItemValues(items: VehicleSelectItem[]): any[] {
    return items.reduce<any[]>((acc, prevItem) => [...acc, getItemValue(prevItem)], []);
}

function serializeOption(option: any, item: VehicleSelectItem, type: number): string {
    if (item.serializeOptionFn) {
        return item.serializeOptionFn(option, item);
    }
    return type == 1 ? option.value : option.key;
}

function deserializeOption<T extends any>(option: string, item: VehicleSelectItem<T>): T {
    if (item.deserializeOptionFn) {
        return item.deserializeOptionFn(option, item);
    }

    return option as any;
}

interface IOptions {
    onChange?: (vehicle: IVehicle | null) => void;
}

export default function useVehicleForm(options: IOptions = {}) {
    const intl = useIntl();
    const { onChange } = options;
    const cancelPrevRequestRef = useRef(() => {});
    const [items, setItems] = useState(makeItems([
        {
            key: 'brand',
            label: intl.formatMessage({ id: 'INPUT_VEHICLE_BRAND_LABEL' }),
            placeholder: intl.formatMessage({ id: 'INPUT_VEHICLE_BRAND_PLACEHOLDER' }),
            optionsSource: vehicleApi.getMakes.bind(vehicleApi),
        },
        {
            key: 'model',
            label: intl.formatMessage({ id: 'INPUT_VEHICLE_MODEL_LABEL' }),
            placeholder: intl.formatMessage({ id: 'INPUT_VEHICLE_MODEL_PLACEHOLDER' }),
            optionsSource: vehicleApi.getModels.bind(vehicleApi),
        },
        {
            key: 'year',
            label: intl.formatMessage({ id: 'INPUT_VEHICLE_YEAR_LABEL' }),
            placeholder: intl.formatMessage({ id: 'INPUT_VEHICLE_YEAR_PLACEHOLDER' }),
            optionsSource: vehicleApi.getYears.bind(vehicleApi),
            serializeOptionFn: (option: number) => option.toString(),
            deserializeOptionFn: (option: string) => parseFloat(option),
        },
        {
            key: 'submodel',
            label: intl.formatMessage({ id: 'INPUT_VEHICLE_SUBMODEL_LABEL' }),
            placeholder: intl.formatMessage({ id: 'INPUT_VEHICLE_SUBMODEL_PLACEHOLDER' }),
            optionsSource: vehicleApi.getSubmodels.bind(vehicleApi),
            // serializeOptionFn: (option: string) => option.toString(),
            // deserializeOptionFn: (option: string) => parseFloat(option),
        },
        {
            key: 'variant',
            label: intl.formatMessage({ id: 'INPUT_VEHICLE_VARIANT_LABEL' }),
            placeholder: intl.formatMessage({ id: 'INPUT_VEHICLE_VARIANT_PLACEHOLDER' }),
            optionsSource: vehicleApi.getVariants.bind(vehicleApi),
            // serializeOptionFn: (option: string) => option.toString(),
            // deserializeOptionFn: (option: string) => parseFloat(option),
        },
        {
            key: 'engine',
            label: intl.formatMessage({ id: 'INPUT_VEHICLE_ENGINE_LABEL' }),
            placeholder: intl.formatMessage({ id: 'INPUT_VEHICLE_ENGINE_PLACEHOLDER' }),
            optionsSource: vehicleApi.getVehicles.bind(vehicleApi),
            serializeOptionFn: (option: IVehicle) => option.engine,
            deserializeOptionFn: (option: string, item: VehicleSelectItem<IVehicle>) => (
                item.options.find((x) => x.engine === option)!
            ),
        },
    ]));
    // debugger
    const load = async (items: VehicleSelectItem[], index: number) => {
        cancelPrevRequestRef.current();

        let canceled = false;
        cancelPrevRequestRef.current = () => {
            canceled = true;
        };

        setItems((prevItems) => [
            ...prevItems.map((prevItem, prevItemIdx) => (
                prevItemIdx !== index ? prevItem : {
                    ...prevItem,
                    loading: true,
                }
            )),
        ]);

        const item = items[index];
        const args = getItemValues(items.slice(0, index));

        let optionsSource = Promise.resolve<any[]>([]);

        if (args.length === 0 || args.slice().pop() !== 'none') {
            optionsSource = item.optionsSource(...args);
        }

        const options = await optionsSource;

        if (canceled) {
            return;
        }

        setItems((prevItems) => [
            ...prevItems.map((prevItem, prevItemIdx) => (
                prevItemIdx !== index ? prevItem : {
                    ...prevItem,
                    options,
                    loading: false,
                }
            )),
        ]);
    };

    const onItemValueChange = (index: number, value: string): void => {
        const nextItemIdx = index + 1;

        setItems((prevItems) => {
            let resultItems = prevItems;

            resultItems = [
                ...resultItems.map(
                    (prevItem, prevItemIdx) => (prevItemIdx !== index ? prevItem : {
                        ...prevItem,
                        value,
                    }),
                ),
            ];

            resultItems = [
                ...resultItems.map(
                    (prevItem, prevItemIdx) => (prevItemIdx <= index ? prevItem : {
                        ...prevItem,
                        value: 'none',
                        options: [],
                        disabled: true,
                    }),
                ),
            ];

            if (value !== 'none' && resultItems[nextItemIdx]) {
                resultItems = [
                    ...resultItems.map(
                        (prevItem, prevItemIdx) => (prevItemIdx !== nextItemIdx ? prevItem : {
                            ...prevItem,
                            disabled: false,
                        }),
                    ),
                ];
            }

            return resultItems;
        });

        if (value === 'none') {
            if (onChange) {
                onChange(null);
            }
        } else if (!items[nextItemIdx] && onChange) {
            onChange(deserializeOption<IVehicle>(value, items[index] as VehicleSelectItem<IVehicle>));
        }
    };

    // Load items.
    useEffect(() => {
        let prevValue = null;

        for (let i = 0; i < items.length; i += 1) {
            const item = items[i];

            if (prevValue !== 'none' && item.options.length === 0 && !item.loading) {
                load(items, i).then();

                return;
            }

            prevValue = item.value;
        }
    }, [items]);

    return {
        items,
        onItemValueChange,
        serializeOption,
    };
}
