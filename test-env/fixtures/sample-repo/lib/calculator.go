package lib

import "fmt"

type Calculator struct {
	Total float64
}

func NewCalculator() *Calculator {
	return &Calculator{Total: 0}
}

func (c *Calculator) Add(x float64) float64 {
	c.Total += x
	return c.Total
}

func (c *Calculator) Subtract(x float64) float64 {
	c.Total -= x
	return c.Total
}

func (c *Calculator) Multiply(x float64) float64 {
	c.Total *= x
	return c.Total
}

func (c *Calculator) Divide(x float64) (float64, error) {
	if x == 0 {
		return 0, fmt.Errorf("division by zero")
	}
	c.Total /= x
	return c.Total, nil
}

func (c *Calculator) Reset() {
	c.Total = 0
}
