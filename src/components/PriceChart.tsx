'use client';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler);

interface PriceChartProps {
  labels: string[];
  values: number[];
}

export default function PriceChart({ labels, values }: PriceChartProps) {
  const data = {
    labels,
    datasets: [
      {
        label: '价格 (¥)',
        data: values,
        borderColor: '#D89414',
        backgroundColor: 'rgba(216,148,20,.10)',
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: '#D89414',
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { display: true, position: 'top' as const },
      tooltip: {
        callbacks: {
          label: (context: any) => `¥${context.parsed.y}`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: false,
        ticks: {
          callback: (value: any) => `¥${value}`,
        },
      },
      x: {
        ticks: {
          maxRotation: 45,
          maxTicksLimit: 10,
        },
      },
    },
  };

  return (
    <div style={{ maxHeight: '300px' }}>
      <Line data={data} options={options} />
    </div>
  );
}
