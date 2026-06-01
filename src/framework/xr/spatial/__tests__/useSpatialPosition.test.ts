import { renderHook, act } from '@testing-library/react-native';
import { useSpatialPosition } from '../useSpatialPosition';

describe('useSpatialPosition', () => {
  it('should initialize with default values', () => {
    const { result } = renderHook(() => useSpatialPosition());

    expect(result.current.transform.position).toEqual({ x: 0, y: 0, z: 0 });
    expect(result.current.transform.rotation).toEqual({ x: 0, y: 0, z: 0 });
    expect(result.current.transform.scale).toEqual({ x: 1, y: 1, z: 1 });
  });

  it('should initialize with provided values', () => {
    const initial = {
      position: { x: 1, y: 2, z: 3 },
      rotation: { x: 0.1, y: 0.2, z: 0.3 },
      scale: { x: 2, y: 2, z: 2 },
    };
    const { result } = renderHook(() => useSpatialPosition(initial));

    expect(result.current.transform.position).toEqual(initial.position);
    expect(result.current.transform.rotation).toEqual(initial.rotation);
    expect(result.current.transform.scale).toEqual(initial.scale);
  });

  it('should update position', () => {
    const { result } = renderHook(() => useSpatialPosition());

    act(() => {
      result.current.setPosition({ x: 10 });
    });
    expect(result.current.transform.position.x).toBe(10);
    expect(result.current.transform.position.y).toBe(0);

    act(() => {
      result.current.setPosition({ y: 5, z: -2 });
    });
    expect(result.current.transform.position).toEqual({ x: 10, y: 5, z: -2 });
  });

  it('should update rotation', () => {
    const { result } = renderHook(() => useSpatialPosition());

    act(() => {
      result.current.setRotation({ y: Math.PI });
    });
    expect(result.current.transform.rotation.y).toBe(Math.PI);
  });

  it('should update scale', () => {
    const { result } = renderHook(() => useSpatialPosition());

    act(() => {
      result.current.setScale({ x: 0.5, y: 0.5, z: 0.5 });
    });
    expect(result.current.transform.scale).toEqual({ x: 0.5, y: 0.5, z: 0.5 });
  });

  it('should reset transform', () => {
    const initial = { position: { x: 1, y: 1, z: 1 } };
    const { result } = renderHook(() => useSpatialPosition(initial));

    act(() => {
      result.current.setPosition({ x: 10 });
      result.current.resetTransform();
    });

    expect(result.current.transform.position).toEqual({ x: 1, y: 1, z: 1 });
  });
});
