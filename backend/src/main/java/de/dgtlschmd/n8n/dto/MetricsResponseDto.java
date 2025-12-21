package de.dgtlschmd.n8n.dto;

import java.time.Instant;
import java.util.List;

public class MetricsResponseDto {
    private String metricType;
    private String unit;
    private List<MetricPoint> points;

    public MetricsResponseDto() {
    }

    public String getMetricType() {
        return metricType;
    }

    public void setMetricType(String metricType) {
        this.metricType = metricType;
    }

    public String getUnit() {
        return unit;
    }

    public void setUnit(String unit) {
        this.unit = unit;
    }

    public List<MetricPoint> getPoints() {
        return points;
    }

    public void setPoints(List<MetricPoint> points) {
        this.points = points;
    }

    public static class MetricPoint {
        private double value;
        private Instant measuredAt;

        public MetricPoint() {
        }

        public double getValue() {
            return value;
        }

        public void setValue(double value) {
            this.value = value;
        }

        public Instant getMeasuredAt() {
            return measuredAt;
        }

        public void setMeasuredAt(Instant measuredAt) {
            this.measuredAt = measuredAt;
        }
    }
}

