export type Result<T, E> = 
  | { ok: true; value: T } 
  | { ok: false; error: E };

export type TimeLevel = "Year" | "Quarter" | "Month" | "Week" | "Day" | "Hour" | "Minute";

export const rollUpTimeLevel = (level: TimeLevel): TimeLevel | null => {
    switch (level) {
        case "Minute": return "Hour";
        case "Hour": return "Day";
        case "Day": return "Week";
        case "Week": return "Month";
        case "Month": return "Quarter";
        case "Quarter": return "Year";
        case "Year": return null;
    }
};

export const drillDownTimeLevel = (level: TimeLevel): TimeLevel | null => {
    switch (level) {
        case "Year": return "Quarter";
        case "Quarter": return "Month";
        case "Month": return "Week";
        case "Week": return "Day";
        case "Day": return "Hour";
        case "Hour": return "Minute";
        case "Minute": return null;
    }
};

export type CaseLevel = "Process" | "Net" | "Case";
export type ActivityLevel = "Process" | "Decomposition" | "Task";
export type ResourceLevel = "Organization" | "Role" | "Participant";
export type PerformanceMetric = "Duration" | "WaitingTime" | "ProcessingTime" | "CycleTime" | "Cost" | "Quality";

export type CubeDimension = 
  | { type: "Time"; level: TimeLevel }
  | { type: "Case"; level: CaseLevel }
  | { type: "Activity"; level: ActivityLevel }
  | { type: "Resource"; level: ResourceLevel }
  | { type: "Performance"; metric: PerformanceMetric };

export const dimensionToString = (dim: CubeDimension): string => {
    switch (dim.type) {
        case "Time": return `Time/${dim.level}`;
        case "Case": return `Case/${dim.level}`;
        case "Activity": return `Activity/${dim.level}`;
        case "Resource": return `Resource/${dim.level}`;
        case "Performance": return `Performance/${dim.metric}`;
    }
};

export const dimensionEquals = (a: CubeDimension, b: CubeDimension): boolean => {
    return dimensionToString(a) === dimensionToString(b);
};

export type Measure = "Frequency" | "Duration" | "Cost" | "Quality";

export type AggregationFunction = "Count" | "Sum" | "Avg" | "Min" | "Max" | "StdDev" | "Median" | "CountDistinct";

export const defaultAggregation = (measure: Measure): AggregationFunction => {
    switch (measure) {
        case "Frequency": return "Count";
        case "Duration": return "Avg";
        case "Cost": return "Sum";
        case "Quality": return "Avg";
    }
};

export interface CubeCell {
    dimensions: Record<string, string>;
    measures: Record<string, number>;
    coordinate: string[];
}

export interface CubeResult {
    measures: Record<string, number>;
    cellCount: number;
    dimensions: string[];
}

export interface PivotTable {
    rows: string[];
    columns: string[];
    data: Record<string, number>;
    rowDimension: CubeDimension;
    columnDimension: CubeDimension;
    valueMeasure: Measure;
}

export type ProcessCubeRefusal = 
  | "DimensionNotFound"
  | "MeasureNotFound"
  | "EmptyCube"
  | "InvalidOperation"
  | "IncompatibleMeasure"
  | "InvalidDrillDown"
  | "InvalidRollUp";

export class ProcessCube {
    public readonly cells: CubeCell[];
    public readonly dimensions: CubeDimension[];
    public readonly measures: Measure[];

    constructor(cells: CubeCell[], dimensions: CubeDimension[], measures: Measure[]) {
        this.cells = cells;
        this.dimensions = dimensions;
        this.measures = measures;
    }

    private hasDimension(dim: CubeDimension): boolean {
        return this.dimensions.some(d => dimensionEquals(d, dim));
    }

    private hasMeasure(measure: Measure): boolean {
        return this.measures.includes(measure);
    }

    public slice(dimension: CubeDimension, value: string): Result<ProcessCube, ProcessCubeRefusal> {
        if (!this.hasDimension(dimension)) {
            return { ok: false, error: "DimensionNotFound" };
        }

        const dimKey = dimensionToString(dimension);
        const filteredCells = this.cells.filter(cell => cell.dimensions[dimKey] === value);

        return {
            ok: true,
            value: new ProcessCube(filteredCells, this.dimensions, this.measures)
        };
    }

    public dice(filters: Array<{ dimension: CubeDimension; value: string }>): Result<ProcessCube, ProcessCubeRefusal> {
        let current: ProcessCube = this;
        for (const filter of filters) {
            const result = current.slice(filter.dimension, filter.value);
            if (!result.ok) {
                return result;
            }
            current = result.value;
        }
        return { ok: true, value: current };
    }

    public aggregate(measures: Measure[]): Result<CubeResult, ProcessCubeRefusal> {
        for (const m of measures) {
            if (!this.hasMeasure(m)) {
                return { ok: false, error: "MeasureNotFound" };
            }
        }

        const measuresMap: Record<string, number> = {};
        let count = 0;

        for (const cell of this.cells) {
            for (const measure of measures) {
                const measureKey = measure.toLowerCase();
                const value = cell.measures[measureKey] ?? 0;
                const agg = defaultAggregation(measure);

                switch (agg) {
                    case "Count":
                        measuresMap["count"] = (measuresMap["count"] ?? 0) + 1;
                        break;
                    case "Sum":
                    case "Avg":
                        measuresMap[`sum_${measureKey}`] = (measuresMap[`sum_${measureKey}`] ?? 0) + value;
                        if (agg === "Avg") {
                            measuresMap[`count_${measureKey}`] = (measuresMap[`count_${measureKey}`] ?? 0) + 1;
                        }
                        break;
                    case "Min":
                        measuresMap[`min_${measureKey}`] = Math.min(measuresMap[`min_${measureKey}`] ?? value, value);
                        break;
                    case "Max":
                        measuresMap[`max_${measureKey}`] = Math.max(measuresMap[`max_${measureKey}`] ?? value, value);
                        break;
                    default:
                        measuresMap[`sum_${measureKey}`] = (measuresMap[`sum_${measureKey}`] ?? 0) + value;
                }
            }
            count++;
        }

        const finalMeasures: Record<string, number> = {};
        for (const [key, value] of Object.entries(measuresMap)) {
            if (key.startsWith("sum_")) {
                const mk = key.substring(4);
                const ck = `count_${mk}`;
                if (ck in measuresMap && measuresMap[ck] > 0) {
                    finalMeasures[`avg_${mk}`] = value / measuresMap[ck];
                }
            }
            finalMeasures[key] = value;
        }

        return {
            ok: true,
            value: {
                measures: finalMeasures,
                cellCount: count,
                dimensions: this.dimensions.map(dimensionToString)
            }
        };
    }

    public rollUp(dimension: CubeDimension, measures: Measure[]): Result<CubeResult, ProcessCubeRefusal> {
        if (!this.hasDimension(dimension)) {
            return { ok: false, error: "DimensionNotFound" };
        }
        if (dimension.type === "Time") {
            const nextLevel = rollUpTimeLevel(dimension.level);
            if (!nextLevel) {
                return { ok: false, error: "InvalidRollUp" };
            }
        }
        
        const aggRes = this.aggregate(measures);
        if (!aggRes.ok) return aggRes;

        const result = aggRes.value;
        return {
            ok: true,
            value: {
                measures: result.measures,
                cellCount: result.cellCount,
                dimensions: [dimensionToString(dimension)]
            }
        };
    }

    public drillDown(dimension: CubeDimension, value: string): Result<ProcessCube, ProcessCubeRefusal> {
        if (!this.hasDimension(dimension)) {
            return { ok: false, error: "DimensionNotFound" };
        }
        if (dimension.type === "Time") {
            const nextLevel = drillDownTimeLevel(dimension.level);
            if (!nextLevel) {
                return { ok: false, error: "InvalidDrillDown" };
            }
        }
        return this.slice(dimension, value);
    }

    public pivot(rowDim: CubeDimension, colDim: CubeDimension, valueMeasure: Measure): Result<PivotTable, ProcessCubeRefusal> {
        if (!this.hasDimension(rowDim) || !this.hasDimension(colDim)) {
            return { ok: false, error: "DimensionNotFound" };
        }
        if (!this.hasMeasure(valueMeasure)) {
            return { ok: false, error: "MeasureNotFound" };
        }

        const rowsSet = new Set<string>();
        const colsSet = new Set<string>();
        const data: Record<string, number> = {};

        const rowKey = dimensionToString(rowDim);
        const colKey = dimensionToString(colDim);
        const measureKey = valueMeasure.toLowerCase();

        for (const cell of this.cells) {
            const rVal = cell.dimensions[rowKey];
            const cVal = cell.dimensions[colKey];
            if (rVal !== undefined && cVal !== undefined) {
                rowsSet.add(rVal);
                colsSet.add(cVal);
                
                const val = cell.measures[measureKey] ?? 0;
                const dataKey = `${rVal}::${cVal}`;
                data[dataKey] = (data[dataKey] ?? 0) + val;
            }
        }

        const rows = Array.from(rowsSet).sort();
        const columns = Array.from(colsSet).sort();

        return {
            ok: true,
            value: {
                rows,
                columns,
                data,
                rowDimension: rowDim,
                columnDimension: colDim,
                valueMeasure
            }
        };
    }

    public groupBy(dimension: CubeDimension): Result<Record<string, CubeCell[]>, ProcessCubeRefusal> {
        if (!this.hasDimension(dimension)) {
            return { ok: false, error: "DimensionNotFound" };
        }

        const dimKey = dimensionToString(dimension);
        const groups: Record<string, CubeCell[]> = {};

        for (const cell of this.cells) {
            const val = cell.dimensions[dimKey] ?? "(null)";
            if (!groups[val]) {
                groups[val] = [];
            }
            groups[val].push(cell);
        }

        return { ok: true, value: groups };
    }
}

export class OlapQuery {
    private cube: ProcessCube;
    private filters: Array<{ dimension: CubeDimension; value: string }>;
    private groupByDims: CubeDimension[];
    private aggregations: Measure[];

    constructor(cube: ProcessCube) {
        this.cube = cube;
        this.filters = [];
        this.groupByDims = [];
        this.aggregations = ["Frequency", "Duration"];
    }

    public filter(dimension: CubeDimension, value: string): OlapQuery {
        this.filters.push({ dimension, value });
        return this;
    }

    public groupBy(dimension: CubeDimension): OlapQuery {
        this.groupByDims.push(dimension);
        return this;
    }

    public aggregate(measures: Measure[]): OlapQuery {
        this.aggregations = measures;
        return this;
    }

    public execute(): Result<Record<string, CubeResult>, ProcessCubeRefusal> {
        let currentCube = this.cube;
        if (this.filters.length > 0) {
            const diced = currentCube.dice(this.filters);
            if (!diced.ok) {
                return diced;
            }
            currentCube = diced.value;
        }

        if (this.groupByDims.length === 0) {
            const agg = currentCube.aggregate(this.aggregations);
            if (!agg.ok) return agg;
            return {
                ok: true,
                value: { "all": agg.value }
            };
        }

        const results: Record<string, CubeResult> = {};
        for (const dimension of this.groupByDims) {
            const groupedResult = currentCube.groupBy(dimension);
            if (!groupedResult.ok) return groupedResult;
            const grouped = groupedResult.value;

            for (const [groupKey, cells] of Object.entries(grouped)) {
                const subCube = new ProcessCube(cells, currentCube.dimensions, currentCube.measures);
                const agg = subCube.aggregate(this.aggregations);
                if (!agg.ok) return agg;
                
                results[`${dimensionToString(dimension)}::${groupKey}`] = agg.value;
            }
        }

        return { ok: true, value: results };
    }
}
